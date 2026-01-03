/**
 * 任务类型定义
 *
 * 该文件定义了 Pro-Agent 项目的任务系统，包括任务类型、状态、依赖关系等。
 *
 * 主要包含：
 * - TaskType: 任务类型枚举（如分析、生成、搜索等）
 * - TaskStatus: 任务状态枚举（如待处理、进行中、已完成等）
 * - Task: 任务定义接口
 * - TaskList: 任务列表接口
 * - TaskExecutionResult: 任务执行结果
 * - ExecutionContext: 执行上下文
 * - QualityCheckResult: 质量检查结果
 * - ReflectionResult: 反思结果
 *
 * 所有类型都使用 Zod 进行验证，确保数据的完整性和一致性。
 */

import { z } from 'zod';

/**
 * 任务类型枚举
 * 定义系统中支持的所有任务类型
 */
export enum TaskType {
  // 原有阶段任务（PPT 生成流程）
  ANALYZE_TOPIC = 'analyze_topic', // 分析用户需求
  GENERATE_COURSE_CONFIG = 'generate_course_config', // 生成课程配置
  GENERATE_VIDEO_OUTLINE = 'generate_video_outline', // 生成视频大纲
  GENERATE_SLIDE_SCRIPTS = 'generate_slide_scripts', // 生成 PPT 脚本
  GENERATE_THEME = 'generate_theme', // 生成主题风格
  GENERATE_SLIDES = 'generate_slides', // 生成 PPT HTML

  // 新增任务类型（扩展功能）
  SEARCH_WEB = 'search_web', // 网络搜索
  ANALYZE_DOCUMENT = 'analyze_document', // 文档分析
  REFINE_CONTENT = 'refine_content', // 内容优化
  VALIDATE_RESULT = 'validate_result', // 结果验证
}

/**
 * 任务状态枚举
 * 定义任务在生命周期中的各种状态
 */
export enum TaskStatus {
  PENDING = 'pending', // 等待执行（依赖未满足）
  READY = 'ready', // 依赖已满足，可以执行
  IN_PROGRESS = 'in_progress', // 执行中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed', // 失败
  SKIPPED = 'skipped', // 跳过（非关键任务失败或条件不满足）
}

/**
 * 任务依赖接口
 * 定义任务之间的依赖关系
 */
export interface TaskDependency {
  taskId: string; // 依赖的任务 ID
  condition?: 'success' | 'any' | 'all'; // 依赖条件：success=成功, any=任意, all=全部
}

/**
 * 任务元数据接口
 * 定义任务的额外信息和配置
 */
export interface TaskMetadata {
  estimatedDuration?: number; // 预计执行时间（秒）
  requiredTools?: string[]; // 需要的工具列表
  canRetry?: boolean; // 是否可以重试
  maxRetries?: number; // 最大重试次数
  critical?: boolean; // 是否为关键任务（失败将终止流程）
  retryCount?: number; // 当前重试次数
  createdAt?: number; // 创建时间戳
  updatedAt?: number; // 更新时间戳
}

/**
 * 任务定义接口
 * 定义单个任务的完整结构
 */
export interface Task {
  id: string; // 任务唯一标识
  type: TaskType; // 任务类型
  description: string; // 任务描述
  status: TaskStatus; // 当前状态

  // 任务参数
  parameters: Record<string, any>; // 任务执行所需的参数

  // 依赖关系
  dependencies: TaskDependency[]; // 任务依赖列表

  // 优先级（数字越大优先级越高）
  priority: number; // 任务优先级

  // 执行结果
  result?: any; // 任务执行结果

  // 错误信息
  error?: string; // 错误信息（如果失败）

  // 重试次数
  retryCount?: number; // 已重试次数

  // 元数据
  metadata: TaskMetadata; // 任务元数据
}

/**
 * 任务列表接口
 * 定义一组相关任务的集合
 */
export interface TaskList {
  id: string; // 任务列表唯一标识
  sessionId: string; // 会话 ID
  topic: string; // 主题/需求
  tasks: Task[]; // 任务列表
  currentTaskIndex?: number; // 当前执行的任务索引
  status: 'planning' | 'executing' | 'completed' | 'failed'; // 任务列表状态
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
}

/**
 * 任务执行结果接口
 * 定义任务执行后的结果
 */
export interface TaskExecutionResult {
  success: boolean; // 是否成功
  result?: any; // 执行结果
  error?: string; // 错误信息（如果失败）
  executionTime?: number; // 执行耗时（毫秒）
}

/**
 * 执行上下文接口
 * 定义任务执行时的上下文环境
 */
export interface ExecutionContext {
  sessionId: string; // 会话 ID
  topic: string; // 主题/需求
  artifacts: any[]; // 已生成的工件列表
  taskList: TaskList; // 任务列表
  history?: any[]; // 历史记录
  refinementPrompt?: string; // 优化提示
  chatMessageId?: string; // 聊天消息 ID
}

/**
 * 质量检查结果接口
 * 定义任务结果的质量评估
 */
export interface QualityCheckResult {
  isComplete: boolean; // 是否完整
  meetsExpectations: boolean; // 是否符合预期
  hasErrors: boolean; // 是否有错误
  issues: string[]; // 问题列表
  score: number; // 质量分数（0-100）
  needsRefinement: boolean; // 是否需要优化
}

/**
 * 反思结果接口
 * 定义任务执行后的反思和决策
 */
export interface ReflectionResult {
  needsNewTasks: boolean; // 是否需要新任务
  shouldContinue: boolean; // 是否继续执行
  reason: string; // 决策原因
  newTaskSuggestions?: Partial<Task>[]; // 新任务建议
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
