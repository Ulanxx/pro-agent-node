import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { PlannerService } from '../planner/planner.service';
import { TaskSchedulerService } from '../scheduler/task-scheduler.service';
import { TaskExecutorService } from '../executor/task-executor.service';
import { ReflectorService } from '../reflector/reflector.service';
import { TaskListService } from '../task-list/task-list.service';
import { ArtifactService } from '../artifact.service';
import { SocketGateway } from '../../socket/socket.gateway';
import {
  AutonomousAgentState,
  AutonomousAgentStateType,
} from './autonomous-state';
import { Task, TaskStatus, TaskType } from '../../../core/dsl/task.types';
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
    private readonly artifactService: ArtifactService,
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
   * 决定下一步操作（增强版：包含完整性和依赖关系检查）
   */
  private decideNextStep(state: AutonomousAgentStateType): 'continue' | 'end' {
    const reflection = state.reflection;
    const currentTask = state.currentTask;

    // 1. 如果没有当前任务，检查是否有待执行任务
    if (!currentTask) {
      this.logger.log('No current task, checking for pending tasks');

      if (state.taskList) {
        const hasPendingTasks = state.taskList.tasks.some(
          (t) =>
            t.status === TaskStatus.PENDING ||
            t.status === TaskStatus.READY ||
            t.status === TaskStatus.IN_PROGRESS,
        );

        if (hasPendingTasks) {
          this.logger.log('Found pending tasks, continuing execution');
          return 'continue';
        }
      }

      this.logger.log('No pending tasks, ending execution');
      return 'end';
    }

    // 2. 如果反思需要新任务且应该继续，则继续
    if (reflection?.needsNewTasks && reflection?.shouldContinue) {
      this.logger.log('Reflector suggests adding new tasks, continuing');
      return 'continue';
    }

    // 3. 检查当前任务的执行状态
    if (currentTask.status === TaskStatus.COMPLETED) {
      this.logger.log(`Task ${currentTask.id} completed, checking for more tasks`);
      // 继续检查是否有更多任务（在步骤 4 中处理）
    } else if (currentTask.status === TaskStatus.SKIPPED) {
      this.logger.log(`Task ${currentTask.id} was skipped, checking for more tasks`);
      // 继续检查是否有更多任务（在步骤 4 中处理）
    } else if (currentTask.status === TaskStatus.FAILED) {
      const isCritical = this.isCriticalTask(currentTask);
      const maxRetries = currentTask.metadata?.maxRetries || 3;
      const retryCount = currentTask.metadata?.retryCount || 0;

      if (isCritical && retryCount >= maxRetries) {
        this.logger.error(
          `Critical task ${currentTask.id} failed after ${retryCount} retries, ending execution`,
        );
        return 'end';
      } else if (!isCritical && retryCount >= maxRetries) {
        this.logger.warn(
          `Non-critical task ${currentTask.id} failed after ${retryCount} retries, skipping`,
        );
        // 非关键任务失败，继续执行其他任务（在步骤 4 中处理）
      } else {
        this.logger.log(
          `Task ${currentTask.id} will be retried (${retryCount}/${maxRetries}), continuing`,
        );
        return 'continue';
      }
    } else if (currentTask.status === TaskStatus.PENDING) {
      // 任务被重置为 PENDING，需要重新调度
      this.logger.log(`Task ${currentTask.id} is pending for retry, continuing`);
      return 'continue';
    } else if (currentTask.status === TaskStatus.READY) {
      // 任务已准备好执行
      this.logger.log(`Task ${currentTask.id} is ready, continuing`);
      return 'continue';
    }

    // 4. 检查是否还有待执行的任务
    if (state.taskList) {
      const hasPendingTasks = state.taskList.tasks.some(
        (t) =>
          t.status === TaskStatus.PENDING ||
          t.status === TaskStatus.READY ||
          t.status === TaskStatus.IN_PROGRESS,
      );

      if (hasPendingTasks) {
        // 5. 检查下一个待执行任务的依赖是否满足
        const nextTask = this.taskSchedulerService.getNextTask(state.taskList);
        if (nextTask) {
          const dependenciesSatisfied = this.checkDependenciesSatisfied(
            nextTask,
            state.taskList.tasks,
          );

          if (!dependenciesSatisfied) {
            this.logger.warn(
              `Next task ${nextTask.id} dependencies not satisfied, ending execution`,
            );
            return 'end';
          }

          // 6. 检查依赖任务的 artifacts 是否存在
          const artifactsReady = this.checkArtifactsReady(nextTask, state.artifacts || []);

          if (!artifactsReady) {
            this.logger.warn(
              `Next task ${nextTask.id} required artifacts not ready, ending execution`,
            );
            return 'end';
          }

          this.logger.log(`Next task ${nextTask.id} is ready, continuing execution`);
          return 'continue';
        }
      }
    }

    // 7. 如果没有待执行的任务，结束执行
    this.logger.log('No more pending tasks, ending execution');
    return 'end';
  }

  /**
   * 检查任务所需的 artifacts 是否准备好
   */
  private checkArtifactsReady(task: Task, artifacts: any[]): boolean {
    // 根据任务类型检查所需的 artifacts
    const requiredArtifactTypes: { [key: string]: string[] } = {
      [TaskType.GENERATE_COURSE_CONFIG]: ['requirement_analysis'],
      [TaskType.GENERATE_VIDEO_OUTLINE]: ['course_config'],
      [TaskType.GENERATE_SLIDE_SCRIPTS]: ['video_outline', 'course_config'],
      [TaskType.GENERATE_THEME]: ['course_config', 'video_outline'],
      [TaskType.GENERATE_SLIDES]: ['slide_scripts', 'presentation_theme'],
    };

    const requiredTypes = requiredArtifactTypes[task.type];

    if (!requiredTypes || requiredTypes.length === 0) {
      return true; // 无特殊要求
    }

    // 检查所有必需的 artifact 类型是否存在
    for (const artifactType of requiredTypes) {
      const hasArtifact = artifacts.some((a) => a.type === artifactType);
      if (!hasArtifact) {
        this.logger.warn(
          `Task ${task.id} requires artifact type '${artifactType}' which is not available`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * 检查任务的依赖是否满足
   */
  private checkDependenciesSatisfied(task: Task, allTasks: Task[]): boolean {
    for (const dep of task.dependencies) {
      const depTask = allTasks.find((t) => t.id === dep.taskId);
      if (!depTask) {
        this.logger.warn(`Dependency task ${dep.taskId} not found`);
        return false;
      }

      // 根据条件检查依赖
      switch (dep.condition) {
        case 'success':
          if (depTask.status !== TaskStatus.COMPLETED) {
            return false;
          }
          break;
        case 'any':
          if (
            ![
              TaskStatus.COMPLETED,
              TaskStatus.FAILED,
              TaskStatus.SKIPPED,
            ].includes(depTask.status)
          ) {
            return false;
          }
          break;
        case 'all':
        default:
          if (depTask.status !== TaskStatus.COMPLETED) {
            return false;
          }
          break;
      }
    }
    return true;
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
   * 判断任务是否为关键任务
   */
  private isCriticalTask(task: Task): boolean {
    // 默认情况下，只有 GENERATE_SLIDES 是关键任务
    // 也可以通过 task.metadata.critical 字段覆盖
    if (task.metadata && typeof task.metadata.critical === 'boolean') {
      return task.metadata.critical;
    }

    // 默认关键任务列表
    const criticalTaskTypes = [
      TaskType.GENERATE_SLIDES, // 最终 PPT 生成是关键任务
    ];

    return criticalTaskTypes.includes(task.type);
  }

  /**
   * 执行节点：执行当前任务（支持重试和跳过）
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
      `Executor node executing task ${currentTask.id} (${currentTask.type}) for session ${sessionId}`,
    );

    // 获取重试配置
    const maxRetries = currentTask.metadata?.maxRetries || 3;
    const currentRetryCount = currentTask.metadata?.retryCount || 0;
    const isCritical = this.isCriticalTask(currentTask);

    this.logger.log(
      `Task ${currentTask.id} config - maxRetries: ${maxRetries}, currentRetry: ${currentRetryCount}, critical: ${isCritical}`,
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

      // 关键修复：如果任务执行成功并产生了 artifact，将其添加到 state.artifacts
      // 这样后续任务就能通过 context.artifacts 获取到前置任务的产出
      let updatedArtifacts = artifacts || [];
      if (executionResult.success && executionResult.result?.artifactId) {
        // 从 ArtifactService 获取新创建的 artifact
        const newArtifact = await this.artifactService.getArtifact(
          sessionId,
          executionResult.result.artifactId,
        );

        if (newArtifact) {
          updatedArtifacts = [...updatedArtifacts, newArtifact];
          this.logger.log(
            `Added artifact ${executionResult.result.artifactId} to state.artifacts (total: ${updatedArtifacts.length})`,
          );
        } else {
          this.logger.warn(
            `Artifact ${executionResult.result.artifactId} not found in Redis`,
          );
        }
      }

      return {
        executionResult,
        artifacts: updatedArtifacts, // 关键：返回更新后的 artifacts 数组
        currentStage: 'executing',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Executor node failed for task ${currentTask.id}: ${errorMessage}`,
      );

      // 错误恢复逻辑：检查是否可以重试
      if (currentRetryCount < maxRetries) {
        // 可以重试
        const newRetryCount = currentRetryCount + 1;
        this.logger.log(
          `Retrying task ${currentTask.id} (${newRetryCount}/${maxRetries})`,
        );

        // 关键修复：在 taskList.tasks 中找到对应的任务并更新状态
        const taskInList = taskList!.tasks.find(t => t.id === currentTask.id);
        if (taskInList) {
          taskInList.metadata = taskInList.metadata || {};
          taskInList.metadata.retryCount = newRetryCount;
          // 关键修复：重试时设置为 READY 而不是 PENDING
          // 因为任务的依赖已经满足（它之前已经在执行了）
          // getNextTask 只会选择 READY 状态的任务
          taskInList.status = TaskStatus.READY;
          taskInList.metadata.updatedAt = Date.now();
        }

        this.taskSchedulerService.updateTaskStatus(
          taskList!,
          currentTask.id,
          TaskStatus.READY, // 关键：设置为 READY 以便重新调度
          undefined,
          errorMessage,
        );

        await this.taskListService.updateTaskList(taskList!);

        return {
          executionResult: {
            success: false,
            error: errorMessage,
          },
          taskList, // 返回更新后的 taskList
          currentTask: taskInList, // 关键：返回更新后的任务对象，确保下游节点看到正确的状态
          currentStage: 'retrying',
        };
      } else if (!isCritical) {
        // 达到最大重试次数，但是非关键任务，跳过并继续
        this.logger.warn(
          `Task ${currentTask.id} skipped after ${maxRetries} retries (non-critical)`,
        );

        // 更新 taskList 中的任务状态
        const taskInList = taskList!.tasks.find(t => t.id === currentTask.id);
        if (taskInList) {
          taskInList.status = TaskStatus.SKIPPED;
          taskInList.metadata = taskInList.metadata || {};
          taskInList.metadata.updatedAt = Date.now();
        }

        this.taskSchedulerService.updateTaskStatus(
          taskList!,
          currentTask.id,
          TaskStatus.SKIPPED,
          undefined,
          errorMessage,
        );

        await this.taskListService.updateTaskList(taskList!);

        return {
          executionResult: {
            success: false,
            error: errorMessage,
          },
          taskList, // 返回更新后的 taskList
          currentTask: taskInList, // 返回更新后的任务对象（已设置为 SKIPPED）
          currentStage: 'executing',
        };
      } else {
        // 达到最大重试次数，且是关键任务，终止流程
        this.logger.error(
          `Critical task ${currentTask.id} failed after ${maxRetries} retries. Aborting execution.`,
        );

        // 更新 taskList 中的任务状态
        const taskInList = taskList!.tasks.find(t => t.id === currentTask.id);
        if (taskInList) {
          taskInList.status = TaskStatus.FAILED;
          taskInList.metadata = taskInList.metadata || {};
          taskInList.metadata.updatedAt = Date.now();
        }

        this.taskSchedulerService.updateTaskStatus(
          taskList!,
          currentTask.id,
          TaskStatus.FAILED,
          undefined,
          errorMessage,
        );

        await this.taskListService.updateTaskList(taskList!);

        return {
          executionResult: {
            success: false,
            error: errorMessage,
          },
          taskList, // 返回更新后的 taskList
          currentTask: taskInList, // 返回更新后的任务对象（已设置为 FAILED）
          currentStage: 'failed',
        };
      }
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
        const newTaskIds: string[] = [];
        
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
          newTaskIds.push(newTask.id);
        }

        // 检查新任务的依赖是否满足，如果满足则设置为 READY
        for (const taskId of newTaskIds) {
          const task = taskList.tasks.find(t => t.id === taskId);
          if (task && task.status === TaskStatus.PENDING) {
            const dependenciesSatisfied = this.checkDependenciesSatisfied(task, taskList.tasks);
            if (dependenciesSatisfied) {
              task.status = TaskStatus.READY;
              this.logger.log(`New task ${taskId} is now READY (dependencies satisfied)`);
            }
          }
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
