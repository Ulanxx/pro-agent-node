# AI 自主规划架构设计

## 概述

本文档描述了如何在现有 PPT 生成系统中实现 AI 自主任务规划能力，采用**规划-执行循环**架构。

## 架构目标

1. **自主性**：AI 能够根据用户需求自主决定任务流程
2. **灵活性**：支持动态调整任务顺序和依赖关系
3. **可控性**：保留对 AI 规划范围的限制，确保可预测性
4. **可扩展性**：便于添加新的任务类型和工具

## 核心架构

### 1. 整体流程图

```
用户请求
    ↓
意图分类（IntentClassifier）
    ↓
规划节点（Planner Node）→ 生成任务列表
    ↓
任务调度器（Task Scheduler）
    ↓
┌─────────────────────────────────────┐
│  执行循环（Execution Loop）          │
│  ┌───────────────────────────────┐  │
│  │ 选择下一个任务                 │  │
│  │         ↓                      │  │
│  │ 执行任务（Task Executor）       │  │
│  │         ↓                      │  │
│  │ 更新状态                       │  │
│  │         ↓                      │  │
│  │ 反思节点（Reflector）           │  │
│  │         ↓                      │  │
│  │  是否需要新任务？               │  │
│  │    是 → 生成新任务 → 循环       │  │
│  │    否 → 检查是否完成            │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
    ↓
返回结果
```

### 2. 核心组件

#### 2.1 任务定义（Task Definition）

```typescript
// src/core/dsl/task.types.ts

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

export enum TaskStatus {
  PENDING = 'pending',
  READY = 'ready',      // 依赖已满足，可以执行
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface TaskDependency {
  taskId: string;
  condition?: 'success' | 'any' | 'all';
}

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  status: TaskStatus;
  
  // 任务参数
  parameters: Record<string, any>;
  
  // 依赖关系
  dependencies: TaskDependency[];
  
  // 优先级
  priority: number;
  
  // 执行结果
  result?: any;
  
  // 错误信息
  error?: string;
  
  // 元数据
  metadata: {
    estimatedDuration?: number;
    requiredTools?: string[];
    canRetry?: boolean;
    maxRetries?: number;
  };
}

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
```

#### 2.2 规划节点（Planner Node）

```typescript
// src/modules/agent/planner/planner.service.ts

@Injectable()
export class PlannerService {
  /**
   * 根据用户需求生成任务列表
   */
  async planTasks(
    sessionId: string,
    topic: string,
    context: {
      history: Message[];
      existingArtifacts: Artifact[];
      refinementPrompt?: string;
    }
  ): Promise<TaskList> {
    // 1. 分析用户需求
    const analysis = await this.analyzeRequirement(topic, context);
    
    // 2. 生成初始任务列表
    const tasks = await this.generateInitialTasks(analysis, context);
    
    // 3. 构建任务依赖关系
    this.buildDependencies(tasks);
    
    // 4. 设置任务优先级
    this.setPriorities(tasks);
    
    return {
      id: `tasklist_${uuidv4()}`,
      sessionId,
      topic,
      tasks,
      status: 'executing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  
  /**
   * 在执行过程中动态添加新任务
   */
  async addNewTasks(
    taskList: TaskList,
    reason: string,
    context: any
  ): Promise<Task[]> {
    const newTasks = await this.generateDynamicTasks(reason, context);
    taskList.tasks.push(...newTasks);
    this.buildDependencies(newTasks);
    return newTasks;
  }
}
```

#### 2.3 任务调度器（Task Scheduler）

```typescript
// src/modules/agent/scheduler/task-scheduler.service.ts

@Injectable()
export class TaskSchedulerService {
  /**
   * 获取下一个可执行的任务
   */
  getNextTask(taskList: TaskList): Task | null {
    // 1. 找出所有状态为 READY 的任务
    const readyTasks = taskList.tasks.filter(
      t => t.status === TaskStatus.READY
    );
    
    if (readyTasks.length === 0) {
      return null;
    }
    
    // 2. 按优先级排序
    readyTasks.sort((a, b) => b.priority - a.priority);
    
    // 3. 返回优先级最高的任务
    return readyTasks[0];
  }
  
  /**
   * 更新任务状态并检查依赖
   */
  updateTaskStatus(
    taskList: TaskList,
    taskId: string,
    status: TaskStatus,
    result?: any
  ): Task[] {
    const task = taskList.tasks.find(t => t.id === taskId);
    if (!task) return [];
    
    task.status = status;
    task.result = result;
    
    // 更新依赖此任务的其他任务状态
    const dependentTasks = taskList.tasks.filter(t =>
      t.dependencies.some(d => d.taskId === taskId)
    );
    
    const newlyReadyTasks: Task[] = [];
    
    for (const dependent of dependentTasks) {
      if (this.areDependenciesSatisfied(dependent, taskList.tasks)) {
        dependent.status = TaskStatus.READY;
        newlyReadyTasks.push(dependent);
      }
    }
    
    return newlyReadyTasks;
  }
  
  /**
   * 检查任务依赖是否满足
   */
  private areDependenciesSatisfied(task: Task, allTasks: Task[]): boolean {
    for (const dep of task.dependencies) {
      const depTask = allTasks.find(t => t.id === dep.taskId);
      if (!depTask) return false;
      
      if (dep.condition === 'success' && depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }
}
```

#### 2.4 任务执行器（Task Executor）

```typescript
// src/modules/agent/executor/task-executor.service.ts

@Injectable()
export class TaskExecutorService {
  constructor(
    private readonly agentService: AgentService,
    private readonly artifactService: ArtifactService,
    private readonly socketGateway: SocketGateway,
  ) {}
  
  /**
   * 执行单个任务
   */
  async executeTask(
    sessionId: string,
    task: Task,
    context: ExecutionContext
  ): Promise<TaskExecutionResult> {
    this.socketGateway.emitTaskStart(sessionId, {
      taskId: task.id,
      taskType: task.type,
      description: task.description,
    });
    
    try {
      let result: any;
      
      // 根据任务类型路由到不同的执行器
      switch (task.type) {
        case TaskType.ANALYZE_TOPIC:
          result = await this.executeAnalyzeTask(task, context);
          break;
        case TaskType.GENERATE_COURSE_CONFIG:
          result = await this.executeCourseConfigTask(task, context);
          break;
        case TaskType.GENERATE_VIDEO_OUTLINE:
          result = await this.executeVideoOutlineTask(task, context);
          break;
        case TaskType.GENERATE_SLIDE_SCRIPTS:
          result = await this.executeSlideScriptsTask(task, context);
          break;
        case TaskType.GENERATE_THEME:
          result = await this.executeThemeTask(task, context);
          break;
        case TaskType.GENERATE_SLIDES:
          result = await this.executeSlidesTask(task, context);
          break;
        case TaskType.SEARCH_WEB:
          result = await this.executeWebSearchTask(task, context);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      this.socketGateway.emitTaskComplete(sessionId, {
        taskId: task.id,
        result,
      });
      
      return {
        success: true,
        result,
      };
    } catch (error) {
      this.socketGateway.emitTaskError(sessionId, {
        taskId: task.id,
        error: error.message,
      });
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // 具体任务执行方法...
  private async executeAnalyzeTask(task: Task, context: ExecutionContext) {
    const analysis = await this.agentService.analyzeTopic(
      context.topic
    );
    
    // 保存 artifact
    const artifact: Artifact = {
      id: `art_analysis_${task.id}`,
      type: 'requirement_analysis',
      content: analysis,
      version: 'v1',
      timestamp: Date.now(),
    };
    await this.artifactService.saveArtifact(context.sessionId, artifact);
    
    return { analysis, artifactId: artifact.id };
  }
  
  // ... 其他任务执行方法
}
```

#### 2.5 反思节点（Reflector Node）

```typescript
// src/modules/agent/reflector/reflector.service.ts

@Injectable()
export class ReflectorService {
  /**
   * 反思执行结果，决定是否需要新任务
   */
  async reflect(
    taskList: TaskList,
    completedTask: Task,
    context: ExecutionContext
  ): Promise<ReflectionResult> {
    // 1. 检查任务是否成功
    if (completedTask.status !== TaskStatus.COMPLETED) {
      return {
        needsNewTasks: false,
        shouldContinue: false,
        reason: 'Task failed, stopping execution',
      };
    }
    
    // 2. 分析结果质量
    const qualityCheck = await this.checkResultQuality(completedTask, context);
    
    // 3. 判断是否需要优化任务
    if (qualityCheck.needsRefinement) {
      return {
        needsNewTasks: true,
        newTaskSuggestions: [
          {
            type: TaskType.REFINE_CONTENT,
            description: `优化 ${completedTask.type} 的结果`,
            parameters: {
              taskId: completedTask.id,
              issues: qualityCheck.issues,
            },
            dependencies: [{ taskId: completedTask.id, condition: 'success' }],
            priority: 10,
          },
        ],
        shouldContinue: true,
        reason: 'Result quality needs improvement',
      };
    }
    
    // 4. 检查是否需要补充任务
    const additionalTasks = await this.suggestAdditionalTasks(
      completedTask,
      context
    );
    
    if (additionalTasks.length > 0) {
      return {
        needsNewTasks: true,
        newTaskSuggestions: additionalTasks,
        shouldContinue: true,
        reason: 'Additional tasks needed based on current result',
      };
    }
    
    // 5. 检查是否所有任务完成
    const allCompleted = taskList.tasks.every(
      t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED
    );
    
    return {
      needsNewTasks: false,
      shouldContinue: !allCompleted,
      reason: allCompleted ? 'All tasks completed' : 'Continue with remaining tasks',
    };
  }
  
  /**
   * 检查结果质量
   */
  private async checkResultQuality(
    task: Task,
    context: ExecutionContext
  ): Promise<QualityCheckResult> {
    // 使用 AI 评估结果质量
    const qualityPrompt = `
评估以下任务结果的质量：
任务类型：${task.type}
任务描述：${task.description}
执行结果：${JSON.stringify(task.result)}

请评估：
1. 结果是否完整？
2. 结果是否符合预期？
3. 是否存在明显错误或遗漏？

返回 JSON 格式的评估结果。
`;
    
    const evaluation = await this.agentService.evaluateQuality(qualityPrompt);
    
    return evaluation;
  }
  
  /**
   * 建议补充任务
   */
  private async suggestAdditionalTasks(
    completedTask: Task,
    context: ExecutionContext
  ): Promise<Partial<Task>[]> {
    // 根据任务类型和结果，建议可能的后续任务
    const suggestions: Partial<Task>[] = [];
    
    // 示例：如果生成了课程配置，可能需要搜索相关资料
    if (completedTask.type === TaskType.GENERATE_COURSE_CONFIG) {
      const courseConfig = completedTask.result;
      if (courseConfig?.targetAudience) {
        suggestions.push({
          type: TaskType.SEARCH_WEB,
          description: `搜索关于 "${courseConfig.targetAudience}" 的相关资料`,
          parameters: {
            query: `${courseConfig.targetAudience} 教学方法 最佳实践`,
          },
          dependencies: [{ taskId: completedTask.id, condition: 'success' }],
          priority: 5,
        });
      }
    }
    
    return suggestions;
  }
}
```

### 3. LangGraph 集成

```typescript
// src/modules/agent/graph/autonomous-graph.service.ts

@Injectable()
export class AutonomousGraphService {
  constructor(
    private readonly plannerService: PlannerService,
    private readonly taskSchedulerService: TaskSchedulerService,
    private readonly taskExecutorService: TaskExecutorService,
    private readonly reflectorService: ReflectorService,
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
        'continue': 'schedulerNode',
        'end': 'endNode',
      }
    );
    
    workflow.addEdge('endNode', END);
    
    return workflow.compile({
      checkpointer: new MemorySaver(),
    });
  }
  
  /**
   * 决定下一步操作
   */
  private decideNextStep(state: AutonomousAgentStateType): 'continue' | 'end' {
    const reflection = state.reflection;
    
    if (reflection.needsNewTasks && reflection.shouldContinue) {
      return 'continue';
    }
    
    // 检查是否还有待执行的任务
    const hasPendingTasks = state.taskList.tasks.some(
      t => t.status === TaskStatus.PENDING || t.status === TaskStatus.READY
    );
    
    return hasPendingTasks ? 'continue' : 'end';
  }
  
  // 节点实现...
  private async plannerNode(state: AutonomousAgentStateType) {
    const taskList = await this.plannerService.planTasks(
      state.sessionId,
      state.topic,
      {
        history: state.history,
        existingArtifacts: state.artifacts,
        refinementPrompt: state.refinementPrompt,
      }
    );
    
    return { taskList, currentStage: 'planning' };
  }
  
  private async schedulerNode(state: AutonomousAgentStateType) {
    const nextTask = this.taskSchedulerService.getNextTask(state.taskList);
    
    if (!nextTask) {
      return { currentTask: null, currentStage: 'scheduling' };
    }
    
    // 更新任务状态为执行中
    this.taskSchedulerService.updateTaskStatus(
      state.taskList,
      nextTask.id,
      TaskStatus.IN_PROGRESS
    );
    
    return { currentTask: nextTask, currentStage: 'executing' };
  }
  
  private async executorNode(state: AutonomousAgentStateType) {
    if (!state.currentTask) {
      return { executionResult: null };
    }
    
    const context: ExecutionContext = {
      sessionId: state.sessionId,
      topic: state.topic,
      artifacts: state.artifacts,
      taskList: state.taskList,
    };
    
    const result = await this.taskExecutorService.executeTask(
      state.sessionId,
      state.currentTask,
      context
    );
    
    // 更新任务状态
    const status = result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED;
    this.taskSchedulerService.updateTaskStatus(
      state.taskList,
      state.currentTask.id,
      status,
      result.result
    );
    
    return { executionResult: result };
  }
  
  private async reflectorNode(state: AutonomousAgentStateType) {
    if (!state.currentTask) {
      return { reflection: null };
    }
    
    const context: ExecutionContext = {
      sessionId: state.sessionId,
      topic: state.topic,
      artifacts: state.artifacts,
      taskList: state.taskList,
    };
    
    const reflection = await this.reflectorService.reflect(
      state.taskList,
      state.currentTask,
      context
    );
    
    // 如果需要新任务，添加到任务列表
    if (reflection.needsNewTasks && reflection.newTaskSuggestions) {
      const newTasks = await this.plannerService.addNewTasks(
        state.taskList,
        reflection.reason,
        context
      );
    }
    
    return { reflection };
  }
  
  private async endNode(state: AutonomousAgentStateType) {
    // 收集所有结果
    const finalArtifact = state.artifacts.find(
      a => a.type === 'ppt_html_doc'
    );
    
    return { 
      document: finalArtifact?.content,
      currentStage: 'completed',
    };
  }
}
```

### 4. 状态定义

```typescript
// src/modules/agent/graph/autonomous-state.ts

export const AutonomousAgentState = Annotation.Root({
  sessionId: Annotation<string>(),
  topic: Annotation<string>(),
  chatMessageId: Annotation<string>(),
  
  // 任务列表
  taskList: Annotation<TaskList>(),
  
  // 当前执行的任务
  currentTask: Annotation<Task>(),
  
  // 执行结果
  executionResult: Annotation<TaskExecutionResult>(),
  
  // 反思结果
  reflection: Annotation<ReflectionResult>(),
  
  // 上下文
  history: Annotation<Message[]>(),
  artifacts: Annotation<Artifact[]>(),
  
  // 元数据
  currentStage: Annotation<string>(),
  refinementPrompt: Annotation<string>(),
  error: Annotation<string>(),
});

export type AutonomousAgentStateType = typeof AutonomousAgentState.State;
```

## 实施路径

### 阶段 1：基础架构（1-2周）
- [ ] 定义任务类型和状态
- [ ] 实现任务调度器
- [ ] 实现任务执行器
- [ ] 创建基础的任务管理服务

### 阶段 2：规划节点（1周）
- [ ] 实现规划服务
- [ ] 创建任务生成 prompt
- [ ] 实现任务依赖构建逻辑

### 阶段 3：反思节点（1周）
- [ ] 实现反思服务
- [ ] 创建质量评估 prompt
- [ ] 实现动态任务生成

### 阶段 4：LangGraph 集成（1周）
- [ ] 创建自主规划图
- [ ] 实现节点和边
- [ ] 测试端到端流程

### 阶段 5：优化和扩展（持续）
- [ ] 添加更多任务类型
- [ ] 优化任务调度算法
- [ ] 改进反思逻辑
- [ ] 添加并行执行支持

## 优势

1. **灵活性**：AI 可以根据实际情况动态调整任务流程
2. **可扩展性**：易于添加新的任务类型和工具
3. **可控性**：通过限制规划范围和任务类型，确保可预测性
4. **可观测性**：任务列表和执行状态完全可见，便于调试
5. **渐进式**：可以逐步迁移现有功能，不影响现有系统

## 风险和挑战

1. **复杂性增加**：系统复杂度显著提高，需要更多的测试
2. **AI 规划质量**：规划质量依赖于 AI 模型能力
3. **性能开销**：额外的规划、反思步骤会增加执行时间
4. **调试难度**：动态任务流程可能增加调试难度

## 总结

这个架构设计在保持现有系统稳定性的基础上，引入了 AI 自主规划能力。通过规划-执行循环，AI 可以根据实际情况动态调整任务流程，同时保持足够的可控性。建议采用渐进式实施策略，逐步迁移现有功能到新架构中。
