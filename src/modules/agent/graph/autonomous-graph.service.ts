import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { PlannerService } from '../planner/planner.service';
import { TaskSchedulerService } from '../scheduler/task-scheduler.service';
import { TaskExecutorService } from '../executor/task-executor.service';
import { ReflectorService } from '../reflector/reflector.service';
import { TaskListService } from '../task-list/task-list.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { AutonomousAgentState, AutonomousAgentStateType } from './autonomous-state';
import { Task, TaskStatus } from '../../../core/dsl/task.types';
import { PptHtmlDocument } from '../../../core/dsl/types';

@Injectable()
export class AutonomousGraphService {
  private readonly logger = new Logger(AutonomousGraphService.name);

  constructor(
    private readonly plannerService: PlannerService,
    private readonly taskSchedulerService: TaskSchedulerService,
    private readonly taskExecutorService: TaskExecutorService,
    private readonly reflectorService: ReflectorService,
    private readonly taskListService: TaskListService,
    @Inject(forwardRef(() => SocketGateway))
    private readonly socketGateway: SocketGateway,
  ) {}

  /**
   * 创建自主规划图
   */
  createGraph() {
    const workflow = new StateGraph(AutonomousAgentState)
      .addNode('plannerNode', (state) => this.plannerNode(state))
      .addNode('schedulerNode', (state) => this.schedulerNode(state))
      .addNode('executorNode', (state) => this.executorNode(state))
      .addNode('reflectorNode', (state) => this.reflectorNode(state))
      .addNode('endNode', (state) => this.endNode(state));

    // 构建边
    workflow.addEdge(START, 'plannerNode');
    workflow.addEdge('plannerNode', 'schedulerNode');
    workflow.addEdge('schedulerNode', 'executorNode');
    workflow.addEdge('executorNode', 'reflectorNode');

    // 条件边：反思节点决定下一步
    workflow.addConditionalEdges(
      'reflectorNode',
      (state) => this.decideNextStep(state),
      {
        continue: 'schedulerNode',
        end: 'endNode',
      },
    );

    workflow.addEdge('endNode', END);

    return workflow.compile({
      checkpointer: new MemorySaver(),
    });
  }

  /**
   * 执行自主规划流程
   */
  async execute(
    sessionId: string,
    topic: string,
    chatMessageId: string,
    context: {
      history: any[];
      existingArtifacts: any[];
      refinementPrompt?: string;
    },
  ): Promise<PptHtmlDocument | null> {
    const graph = this.createGraph();
    const config = { configurable: { thread_id: sessionId } };

    const initialState: Partial<AutonomousAgentStateType> = {
      sessionId,
      topic,
      chatMessageId,
      history: context.history || [],
      artifacts: context.existingArtifacts || [],
      refinementPrompt: context.refinementPrompt,
      currentStage: 'planning',
    };

    this.logger.log(
      `Starting autonomous planning for session ${sessionId}: ${topic}`,
    );

    try {
      const result = await graph.invoke(initialState, config);
      // 从 artifacts 中查找最终的 PPT 文档
      const finalArtifact = result.artifacts?.find((a) => a.type === 'ppt_html_doc');
      return finalArtifact?.content || null;
    } catch (error) {
      this.logger.error(`Autonomous planning failed: ${error}`);
      throw error;
    }
  }

  /**
   * 决定下一步操作
   */
  private decideNextStep(state: AutonomousAgentStateType): 'continue' | 'end' {
    const reflection = state.reflection;

    if (reflection?.needsNewTasks && reflection?.shouldContinue) {
      return 'continue';
    }

    // 检查是否还有待执行的任务
    if (state.taskList) {
      const hasPendingTasks = state.taskList.tasks.some(
        (t) =>
          t.status === TaskStatus.PENDING ||
          t.status === TaskStatus.READY ||
          t.status === TaskStatus.IN_PROGRESS,
      );

      if (hasPendingTasks) {
        return 'continue';
      }
    }

    return 'end';
  }

  // --- Nodes ---

  /**
   * 规划节点：生成任务列表
   */
  private async plannerNode(state: AutonomousAgentStateType) {
    const { sessionId, topic, history, artifacts, refinementPrompt } = state;

    this.logger.log(`Planner node executing for session ${sessionId}`);

    try {
      const taskList = await this.plannerService.planTasks(
        sessionId,
        topic,
        {
          history: history || [],
          existingArtifacts: artifacts || [],
          refinementPrompt,
        },
      );

      // 保存任务列表
      await this.taskListService.saveTaskList(taskList);

      // 初始化任务状态
      this.taskSchedulerService.initializeTaskList(taskList);

      this.logger.log(
        `Planner node completed: ${taskList.tasks.length} tasks generated`,
      );

      return {
        taskList,
        currentStage: 'executing',
      };
    } catch (error) {
      this.logger.error(`Planner node failed: ${error}`);
      return {
        error: error instanceof Error ? error.message : String(error),
        currentStage: 'failed',
      };
    }
  }

  /**
   * 调度节点：选择下一个任务
   */
  private async schedulerNode(state: AutonomousAgentStateType) {
    const { taskList } = state;

    if (!taskList) {
      this.logger.warn('No task list found in scheduler node');
      return {
        currentTask: null,
        currentStage: 'scheduling',
      };
    }

    this.logger.log(`Scheduler node executing for session ${state.sessionId}`);

    // 获取下一个可执行的任务
    const nextTask = this.taskSchedulerService.getNextTask(taskList);

    if (!nextTask) {
      this.logger.log('No ready tasks found');
      return {
        currentTask: null,
        currentStage: 'scheduling',
      };
    }

    // 更新任务状态为执行中
    this.taskSchedulerService.updateTaskStatus(
      taskList,
      nextTask.id,
      TaskStatus.IN_PROGRESS,
    );

    // 保存更新后的任务列表
    await this.taskListService.updateTaskList(taskList);

    this.logger.log(
      `Scheduler node completed: next task ${nextTask.id} (${nextTask.type})`,
    );

    return {
      currentTask: nextTask,
      currentStage: 'executing',
    };
  }

  /**
   * 执行节点：执行当前任务
   */
  private async executorNode(state: AutonomousAgentStateType) {
    const { sessionId, topic, taskList, currentTask, artifacts, chatMessageId } = state;

    if (!currentTask) {
      this.logger.warn('No current task to execute');
      return {
        executionResult: null,
        currentStage: 'executing',
      };
    }

    this.logger.log(
      `Executor node executing task ${currentTask.id} for session ${sessionId}`,
    );

    try {
      const executionContext = {
        sessionId,
        topic,
        artifacts: artifacts || [],
        taskList: taskList!,
        chatMessageId,
        refinementPrompt: state.refinementPrompt,
      };

      const executionResult =
        await this.taskExecutorService.executeTask(
          sessionId,
          currentTask,
          executionContext,
        );

      // 更新任务状态
      const status = executionResult.success
        ? TaskStatus.COMPLETED
        : TaskStatus.FAILED;

      this.taskSchedulerService.updateTaskStatus(
        taskList!,
        currentTask.id,
        status,
        executionResult.result,
        executionResult.error,
      );

      // 保存更新后的任务列表
      await this.taskListService.updateTaskList(taskList!);

      this.logger.log(
        `Executor node completed: task ${currentTask.id} ${status}`,
      );

      return {
        executionResult,
        currentStage: 'executing',
      };
    } catch (error) {
      this.logger.error(`Executor node failed: ${error}`);

      // 更新任务状态为失败
      this.taskSchedulerService.updateTaskStatus(
        taskList!,
        currentTask.id,
        TaskStatus.FAILED,
        undefined,
        error instanceof Error ? error.message : String(error),
      );

      await this.taskListService.updateTaskList(taskList!);

      return {
        executionResult: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        currentStage: 'failed',
      };
    }
  }

  /**
   * 反思节点：评估执行结果并决定下一步
   */
  private async reflectorNode(state: AutonomousAgentStateType) {
    const { taskList, currentTask, executionResult, sessionId, topic, artifacts } =
      state;

    if (!currentTask || !taskList) {
      this.logger.warn('No task to reflect on');
      return {
        reflection: null,
        currentStage: 'reflecting',
      };
    }

    this.logger.log(
      `Reflector node reflecting on task ${currentTask.id} for session ${sessionId}`,
    );

    try {
      const reflection = await this.reflectorService.reflect(
        taskList,
        currentTask,
        {
          sessionId,
          topic,
          artifacts: artifacts || [],
        },
      );

      // 如果需要新任务，添加到任务列表
      if (reflection.needsNewTasks && reflection.newTaskSuggestions) {
        for (const taskSuggestion of reflection.newTaskSuggestions) {
          const newTask: Task = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: taskSuggestion.type as any,
            description: taskSuggestion.description || '',
            status: TaskStatus.PENDING,
            parameters: taskSuggestion.parameters || {},
            dependencies: taskSuggestion.dependencies || [],
            priority: taskSuggestion.priority || 5,
            metadata: {
              ...taskSuggestion.metadata,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          };

          taskList.tasks.push(newTask);
        }

        // 保存更新后的任务列表
        await this.taskListService.updateTaskList(taskList);

        this.logger.log(
          `Reflector node added ${reflection.newTaskSuggestions.length} new tasks`,
        );
      }

      // 更新任务列表状态
      if (reflection.shouldContinue) {
        taskList.status = 'executing';
      } else {
        taskList.status = 'completed';
      }

      await this.taskListService.updateTaskList(taskList);

      this.logger.log(
        `Reflector node completed: ${reflection.reason}`,
      );

      return {
        reflection,
        currentStage: reflection.shouldContinue ? 'executing' : 'completed',
      };
    } catch (error) {
      this.logger.error(`Reflector node failed: ${error}`);
      return {
        reflection: {
          needsNewTasks: false,
          shouldContinue: false,
          reason: `Reflection failed: ${error}`,
        },
        currentStage: 'failed',
      };
    }
  }

  /**
   * 结束节点：收集最终结果
   */
  private async endNode(state: AutonomousAgentStateType) {
    const { artifacts } = state;

    this.logger.log(`End node executing for session ${state.sessionId}`);

    // 查找最终的 PPT 文档
    const finalArtifact = artifacts?.find((a) => a.type === 'ppt_html_doc');

    if (!finalArtifact) {
      this.logger.warn('No final PPT document found');
      return {
        document: null,
        currentStage: 'completed',
      };
    }

    const document = finalArtifact.content as PptHtmlDocument;

    this.logger.log(
      `End node completed: final document with ${document.pages.length} pages`,
    );

    return {
      document,
      currentStage: 'completed',
    };
  }
}
