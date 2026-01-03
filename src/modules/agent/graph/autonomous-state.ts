import { Annotation } from '@langchain/langgraph';
import {
  Task,
  TaskList,
  TaskExecutionResult,
  ReflectionResult,
} from '../../../core/dsl/task.types';

/**
 * 自主规划 Agent 状态定义
 * 用于 LangGraph 中的状态流转
 */
export const AutonomousAgentState = Annotation.Root({
  sessionId: Annotation<string>(),
  topic: Annotation<string>(),
  chatMessageId: Annotation<string>(),
  applicationId: Annotation<string>(), // 应用ID，用于关联MySQL中的任务和artifacts

  // 任务列表
  taskList: Annotation<TaskList>(),

  // 当前执行的任务
  currentTask: Annotation<Task>(),

  // 执行结果
  executionResult: Annotation<TaskExecutionResult>(),

  // 反思结果
  reflection: Annotation<ReflectionResult>(),

  // 上下文
  history: Annotation<any[]>({
    default: () => [],
    reducer: (x, y) => x.concat(y),
  }),
  artifacts: Annotation<any[]>({
    default: () => [],
    reducer: (x, y) => x.concat(y),
  }),
  refinementPrompt: Annotation<string>(),

  // 元数据
  currentStage: Annotation<string>(),
  error: Annotation<string>(),
});

export type AutonomousAgentStateType = typeof AutonomousAgentState.State;
