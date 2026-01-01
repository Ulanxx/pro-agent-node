import { z } from 'zod';

/**
 * 任务类型枚举
 */
export enum TaskType {
  // 原有阶段任务
  ANALYZE_TOPIC = 'analyze_topic',
  GENERATE_COURSE_CONFIG = 'generate_course_config',
  GENERATE_VIDEO_OUTLINE = 'generate_video_outline',
  GENERATE_SLIDE_SCRIPTS = 'generate_slide_scripts',
  GENERATE_THEME = 'generate_theme',
  GENERATE_SLIDES = 'generate_slides',

  // 新增任务类型
  SEARCH_WEB = 'search_web',
  ANALYZE_DOCUMENT = 'analyze_document',
  REFINE_CONTENT = 'refine_content',
  VALIDATE_RESULT = 'validate_result',
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending', // 等待执行
  READY = 'ready', // 依赖已满足，可以执行
  IN_PROGRESS = 'in_progress', // 执行中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed', // 失败
  SKIPPED = 'skipped', // 跳过
}

/**
 * 任务依赖
 */
export interface TaskDependency {
  taskId: string;
  condition?: 'success' | 'any' | 'all';
}

/**
 * 任务元数据
 */
export interface TaskMetadata {
  estimatedDuration?: number;
  requiredTools?: string[];
  canRetry?: boolean;
  maxRetries?: number;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 任务定义
 */
export interface Task {
  id: string;
  type: TaskType;
  description: string;
  status: TaskStatus;

  // 任务参数
  parameters: Record<string, any>;

  // 依赖关系
  dependencies: TaskDependency[];

  // 优先级（数字越大优先级越高）
  priority: number;

  // 执行结果
  result?: any;

  // 错误信息
  error?: string;

  // 重试次数
  retryCount?: number;

  // 元数据
  metadata: TaskMetadata;
}

/**
 * 任务列表
 */
export interface TaskList {
  id: string;
  sessionId: string;
  topic: string;
  tasks: Task[];
  currentTaskIndex?: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  sessionId: string;
  topic: string;
  artifacts: any[];
  taskList: TaskList;
  history?: any[];
  refinementPrompt?: string;
  chatMessageId?: string;
}

/**
 * 质量检查结果
 */
export interface QualityCheckResult {
  isComplete: boolean;
  meetsExpectations: boolean;
  hasErrors: boolean;
  issues: string[];
  score: number; // 0-100
  needsRefinement: boolean;
}

/**
 * 反思结果
 */
export interface ReflectionResult {
  needsNewTasks: boolean;
  shouldContinue: boolean;
  reason: string;
  newTaskSuggestions?: Partial<Task>[];
}

/**
 * Zod Schemas for validation
 */
export const TaskTypeSchema = z.nativeEnum(TaskType);
export const TaskStatusSchema = z.nativeEnum(TaskStatus);

export const TaskDependencySchema = z.object({
  taskId: z.string(),
  condition: z.enum(['success', 'any', 'all']).optional(),
});

export const TaskMetadataSchema = z.object({
  estimatedDuration: z.number().optional(),
  requiredTools: z.array(z.string()).optional(),
  canRetry: z.boolean().optional(),
  maxRetries: z.number().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  type: TaskTypeSchema,
  description: z.string(),
  status: TaskStatusSchema,
  parameters: z.record(z.string(), z.any()),
  dependencies: z.array(TaskDependencySchema),
  priority: z.number(),
  result: z.any().optional(),
  error: z.string().optional(),
  retryCount: z.number().optional(),
  metadata: TaskMetadataSchema,
});

export const TaskListSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  topic: z.string(),
  tasks: z.array(TaskSchema),
  currentTaskIndex: z.number().optional(),
  status: z.enum(['planning', 'executing', 'completed', 'failed']),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const TaskExecutionResultSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number().optional(),
});

export const QualityCheckResultSchema = z.object({
  isComplete: z.boolean(),
  meetsExpectations: z.boolean(),
  hasErrors: z.boolean(),
  issues: z.array(z.string()),
  score: z.number().min(0).max(100),
  needsRefinement: z.boolean(),
});

export const ReflectionResultSchema = z.object({
  needsNewTasks: z.boolean(),
  shouldContinue: z.boolean(),
  reason: z.string(),
  newTaskSuggestions: z.array(z.any()).optional(),
});
