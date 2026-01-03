/**
 * Planner 服务
 *
 * 该服务负责规划 PPT 生成任务，根据用户需求生成任务列表。
 *
 * 主要功能：
 * - 根据用户需求生成初始任务列表
 * - 在执行过程中动态添加新任务
 * - 优化现有任务
 * - 提供回退任务列表（当 AI 规划失败时）
 *
 * 该服务使用 AI 模型来智能规划任务，但也提供了预定义的任务模板作为回退方案。
 *
 * 环境变量：
 * - OPENAI_API_KEY: OpenAI API 密钥
 * - OPENAI_BASEURL: OpenAI API 基础 URL
 * - OPENAI_MODEL: 使用的模型名称
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskList,
  TaskType,
  TaskStatus,
} from '../../../core/dsl/task.types';
import {
  TASK_PLANNING_PROMPT,
  DYNAMIC_TASK_GENERATION_PROMPT,
  TASK_REFINEMENT_PROMPT,
} from '../prompts/autonomous-planning.prompt';
import { TaskSchema, TaskListSchema } from '../../../core/dsl/task.types';

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);
  private planningModel: { invoke: (p: any) => Promise<TaskList> } | undefined; // 任务列表生成模型
  private taskModel: { invoke: (p: any) => Promise<Task> } | undefined; // 单个任务生成模型

  /**
   * 构造函数
   * 初始化 AI 模型实例
   */
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASEURL;
    const modelName =
      process.env.OPENAI_MODEL || 'google/gemini-3-flash-preview';

    // 如果配置了 API 密钥，则初始化 AI 模型
    if (apiKey) {
      const baseModel = new ChatOpenAI({
        modelName,
        temperature: 0.7, // 温度参数，控制输出的随机性
        openAIApiKey: apiKey,
        configuration: {
          baseURL,
          defaultHeaders: {
            'X-Title': 'Pro-Agent PPT Generator',
          },
        },
      });

      // 创建任务列表生成模型
      this.planningModel = baseModel.withStructuredOutput(TaskListSchema);

      // 创建单个任务生成模型
      this.taskModel = baseModel.withStructuredOutput(TaskSchema);
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not found, planning will use fallback logic',
      );
    }
  }

  /**
   * 根据用户需求生成任务列表
   */
  async planTasks(
    sessionId: string,
    topic: string,
    context: {
      history: any[];
      existingArtifacts: any[];
      refinementPrompt?: string;
    },
  ): Promise<TaskList> {
    this.logger.log(`Planning tasks for session ${sessionId}: ${topic}`);

    if (!this.planningModel) {
      // Fallback: 使用预定义的任务模板
      return this.createFallbackTaskList(sessionId, topic);
    }

    try {
      const prompt = await TASK_PLANNING_PROMPT.format({
        topic,
        history: JSON.stringify(context.history || []),
        existingArtifacts: JSON.stringify(context.existingArtifacts || []),
        refinementPrompt: context.refinementPrompt || 'None',
      });

      const taskList = await this.planningModel.invoke(prompt);

      // 确保所有任务都有必需的字段
      taskList.tasks = taskList.tasks.map((task) => ({
        ...task,
        id: task.id || uuidv4(),
        status: task.status || TaskStatus.PENDING,
        priority: task.priority || 10,
        dependencies: task.dependencies || [],
        metadata: {
          ...task.metadata,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }));

      // 设置任务列表元数据
      taskList.id = taskList.id || `tasklist_${uuidv4()}`;
      taskList.sessionId = sessionId;
      taskList.topic = topic;
      taskList.status = 'planning';
      taskList.createdAt = Date.now();
      taskList.updatedAt = Date.now();

      this.logger.log(
        `Generated ${taskList.tasks.length} tasks for session ${sessionId}`,
      );

      return taskList;
    } catch (error) {
      this.logger.error(`Error planning tasks: ${error}`);
      // Fallback to predefined tasks
      return this.createFallbackTaskList(sessionId, topic);
    }
  }

  /**
   * 在执行过程中动态添加新任务
   */
  async addNewTasks(
    taskList: TaskList,
    reason: string,
    context: {
      completedTask?: Task;
      executionResult?: any;
    },
  ): Promise<Task[]> {
    this.logger.log(
      `Adding new tasks to session ${taskList.sessionId}. Reason: ${reason}`,
    );

    if (!this.taskModel) {
      // Fallback: 不添加新任务
      this.logger.warn(
        'Task model not initialized, skipping dynamic task generation',
      );
      return [];
    }

    try {
      const prompt = await DYNAMIC_TASK_GENERATION_PROMPT.format({
        taskList: JSON.stringify(taskList),
        completedTask: context.completedTask
          ? JSON.stringify(context.completedTask)
          : 'None',
        executionResult: context.executionResult
          ? JSON.stringify(context.executionResult)
          : 'None',
        reason,
      });

      const newTask = await this.taskModel.invoke(prompt);

      // 确保新任务有必需的字段
      const task: Task = {
        ...newTask,
        id: uuidv4(),
        status: TaskStatus.PENDING,
        priority: newTask.priority || 5,
        metadata: {
          ...newTask.metadata,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      taskList.tasks.push(task);
      taskList.updatedAt = Date.now();

      this.logger.log(`Added new task ${task.id} of type ${task.type}`);

      return [task];
    } catch (error) {
      this.logger.error(`Error adding new tasks: ${error}`);
      return [];
    }
  }

  /**
   * 优化现有任务
   */
  async refineTask(task: Task, feedback: string): Promise<Task> {
    this.logger.log(`Refining task ${task.id} with feedback: ${feedback}`);

    if (!this.taskModel) {
      // Fallback: 不优化任务
      this.logger.warn('Task model not initialized, skipping task refinement');
      return task;
    }

    try {
      const prompt = await TASK_REFINEMENT_PROMPT.format({
        task: JSON.stringify(task),
        feedback,
      });

      const refinedTask = await this.taskModel.invoke(prompt);

      // 保持 ID 和状态不变
      const updatedTask: Task = {
        ...refinedTask,
        id: task.id,
        status: task.status,
        metadata: {
          ...refinedTask.metadata,
          createdAt: task.metadata.createdAt,
          updatedAt: Date.now(),
        },
      };

      this.logger.log(`Task ${task.id} refined successfully`);

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error refining task: ${error}`);
      return task;
    }
  }

  /**
   * 创建回退任务列表
   * 当 AI 规划失败时使用预定义的任务模板
   */
  private createFallbackTaskList(sessionId: string, topic: string): TaskList {
    this.logger.warn('Using fallback task list');

    const tasks: Task[] = [
      {
        id: uuidv4(),
        type: TaskType.ANALYZE_TOPIC,
        description: '分析用户需求',
        status: TaskStatus.PENDING,
        parameters: { topic },
        dependencies: [],
        priority: 10,
        metadata: {
          estimatedDuration: 30,
          canRetry: true,
          maxRetries: 3,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        id: uuidv4(),
        type: TaskType.GENERATE_COURSE_CONFIG,
        description: '生成课程配置',
        status: TaskStatus.PENDING,
        parameters: {},
        dependencies: [],
        priority: 10,
        metadata: {
          estimatedDuration: 45,
          canRetry: true,
          maxRetries: 3,
          critical: false, // 非关键任务，失败可跳过
          retryCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        id: uuidv4(),
        type: TaskType.GENERATE_VIDEO_OUTLINE,
        description: '生成视频大纲',
        status: TaskStatus.PENDING,
        parameters: {},
        dependencies: [],
        priority: 10,
        metadata: {
          estimatedDuration: 60,
          canRetry: true,
          maxRetries: 3,
          critical: false, // 非关键任务，失败可跳过
          retryCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        id: uuidv4(),
        type: TaskType.GENERATE_SLIDE_SCRIPTS,
        description: '生成 PPT 脚本',
        status: TaskStatus.PENDING,
        parameters: {},
        dependencies: [],
        priority: 10,
        metadata: {
          estimatedDuration: 90,
          canRetry: true,
          maxRetries: 3,
          critical: false, // 非关键任务，失败可跳过
          retryCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        id: uuidv4(),
        type: TaskType.GENERATE_THEME,
        description: '生成主题风格',
        status: TaskStatus.PENDING,
        parameters: {},
        dependencies: [],
        priority: 10,
        metadata: {
          estimatedDuration: 45,
          canRetry: true,
          maxRetries: 3,
          critical: false, // 非关键任务，失败可跳过
          retryCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        id: uuidv4(),
        type: TaskType.GENERATE_SLIDES,
        description: '生成 PPT HTML',
        status: TaskStatus.PENDING,
        parameters: {},
        dependencies: [],
        priority: 10,
        metadata: {
          estimatedDuration: 120,
          canRetry: true,
          maxRetries: 3,
          critical: true, // 关键任务，失败将终止流程
          retryCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    ];

    // 构建依赖关系
    // 注意：必须在所有任务创建完成后才能构建依赖关系，使用实际的 task ID 而非索引
    // 任务顺序: analyze_topic (0) -> course_config (1) -> video_outline (2) -> slide_scripts (3) + theme (4) -> slides (5)
    tasks[1].dependencies = [{ taskId: tasks[0].id, condition: 'success' }]; // course_config 依赖 analyze_topic
    tasks[2].dependencies = [{ taskId: tasks[1].id, condition: 'success' }]; // video_outline 依赖 course_config
    tasks[3].dependencies = [{ taskId: tasks[2].id, condition: 'success' }]; // slide_scripts 依赖 video_outline
    tasks[4].dependencies = [{ taskId: tasks[2].id, condition: 'success' }]; // theme 依赖 video_outline
    tasks[5].dependencies = [
      // slides 依赖 slide_scripts 和 theme（两者都必须成功）
      { taskId: tasks[3].id, condition: 'success' },
      { taskId: tasks[4].id, condition: 'success' },
    ];

    return {
      id: `tasklist_${uuidv4()}`,
      sessionId,
      topic,
      tasks,
      status: 'planning',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
