# Design: 修复 Autonomous Planning 执行流程

## Context

### 当前问题
Autonomous Planning 基于 LangGraph 实现，包含 4 个主要节点（Planner、Scheduler、Executor、Reflector），形成循环工作流。但在实际运行中存在以下问题：

1. **任务依赖关系错误**
   - `createFallbackTaskList` 使用索引构建依赖：`tasks[1].dependencies = [{ taskId: tasks[0].id }]`
   - 问题：在动态添加任务时，索引引用会失效

2. **artifacts 传递断裂**
   - Executor 执行任务后生成 artifact 并保存到 Redis
   - 但 state.artifacts 数组没有更新
   - 导致后续任务无法通过 `context.artifacts` 获取前置任务的产出

3. **错误处理不足**
   - 任务失败后直接返回 `TaskStatus.FAILED`
   - 没有重试机制
   - 没有降级方案
   - 导致整个流程中断

4. **状态检查不完整**
   - `decideNextStep` 只检查 taskList 中是否有待执行任务
   - 没有验证 artifacts 是否完整
   - 没有处理循环依赖的情况

### 约束条件
- 必须保持与 LangGraph 的集成
- 必须兼容现有的 Socket 协议（`tool:message:*` 系列）
- 不能破坏现有的 Redis 数据结构
- 需要支持从中断点恢复

## Goals / Non-Goals

### Goals
1. 修复任务依赖关系构建逻辑，确保动态任务也能正确建立依赖
2. 完善 artifacts 传递链，确保每个任务都能获取到前置任务的产出
3. 实现自动重试机制（最多 3 次）
4. 实现任务跳过机制（非关键任务）
5. 实现降级逻辑（AI 失败时使用 mock 数据）
6. 增强日志和监控，便于排查问题

### Non-Goals
- 不修改 LangGraph 的核心工作流
- 不改变任务类型定义（TaskType）
- 不修改 Socket 协议结构
- 不引入新的存储依赖

## Decisions

### 1. artifacts 传递机制

**决策**：在 `executorNode` 中更新 state.artifacts

**实现**：
```typescript
private async executorNode(state: AutonomousAgentStateType) {
  // ... 执行任务 ...

  if (executionResult.success && executionResult.result?.artifactId) {
    // 从 Redis 获取新创建的 artifact
    const newArtifact = await this.artifactService.getArtifact(
      sessionId,
      executionResult.result.artifactId
    );

    // 更新 state.artifacts
    return {
      executionResult,
      artifacts: [...state.artifacts, newArtifact], // 关键：追加新 artifact
      currentStage: 'executing',
    };
  }
}
```

**理由**：
- LangGraph 的 state 会在节点间传递
- 每次返回新的 artifacts 数组，确保后续节点能看到最新状态
- 不修改原有 artifacts，避免引用问题

### 2. 任务依赖关系构建

**决策**：先创建所有任务，再构建依赖关系

**实现**：
```typescript
private createFallbackTaskList(...) {
  // 1. 创建所有任务（不设置 dependencies）
  const tasks: Task[] = [
    { id: uuidv4(), type: TaskType.ANALYZE_TOPIC, ... },
    { id: uuidv4(), type: TaskType.GENERATE_COURSE_CONFIG, ... },
    // ...
  ];

  // 2. 构建依赖关系（使用实际 ID）
  tasks[1].dependencies = [{ taskId: tasks[0].id, condition: 'success' }];
  tasks[2].dependencies = [{ taskId: tasks[1].id, condition: 'success' }];
  tasks[3].dependencies = [{ taskId: tasks[2].id, condition: 'success' }];
  tasks[4].dependencies = [{ taskId: tasks[2].id, condition: 'success' }];
  tasks[5].dependencies = [
    { taskId: tasks[3].id, condition: 'success' },
    { taskId: tasks[4].id, condition: 'success' }
  ];

  return { id, sessionId, topic, tasks, ... };
}
```

**理由**：
- 分离任务创建和依赖构建
- 使用实际的 task ID 而非索引
- 便于后续扩展（动态添加任务）

### 3. 错误恢复策略

**决策**：三级错误处理
1. **自动重试**：对于临时性错误（网络超时、AI 限流），自动重试最多 3 次
2. **跳过非关键任务**：对于可降级的任务（如 SEARCH_WEB），失败后跳过继续执行
3. **降级处理**：AI 调用失败时，使用 mock 数据或预定义模板

**实现**：
```typescript
private async executorNode(state: AutonomousAgentStateType) {
  const maxRetries = task.metadata.maxRetries || 3;
  let retryCount = task.metadata.retryCount || 0;

  try {
    const result = await this.taskExecutorService.executeTask(...);
    // 成功：更新状态为 COMPLETED
  } catch (error) {
    if (retryCount < maxRetries) {
      // 重试
      task.metadata.retryCount = retryCount + 1;
      task.status = TaskStatus.PENDING;
      return { currentTask: task, shouldRetry: true };
    } else if (this.isNonCriticalTask(task)) {
      // 跳过非关键任务
      task.status = TaskStatus.SKIPPED;
      this.logger.warn(`Task ${task.id} skipped after ${maxRetries} retries`);
      return { currentTask: task, shouldSkip: true };
    } else {
      // 关键任务失败，终止流程
      task.status = TaskStatus.FAILED;
      throw error;
    }
  }
}
```

**理由**：
- 分级处理，避免因小错误导致整个流程失败
- 可配置的重试次数
- 明确的关键/非关键任务区分

### 4. 状态检查增强

**决策**：在 `decideNextStep` 中添加完整性检查

**实现**：
```typescript
private decideNextStep(state: AutonomousAgentStateType): 'continue' | 'end' {
  // 1. 检查是否有待执行任务
  const hasPendingTasks = state.taskList?.tasks.some(
    t => t.status === TaskStatus.PENDING || t.status === TaskStatus.READY
  );

  if (!hasPendingTasks) {
    return 'end';
  }

  // 2. 检查下一个任务的依赖是否满足
  const nextTask = this.taskSchedulerService.getNextTask(state.taskList);
  if (!nextTask) {
    return 'end';
  }

  // 3. 检查依赖任务的 artifacts 是否存在
  const dependenciesSatisfied = this.checkDependenciesSatisfied(nextTask, state);
  if (!dependenciesSatisfied) {
    this.logger.warn(`Task ${nextTask.id} dependencies not satisfied`);
    return 'end'; // 或者返回特殊状态等待重试
  }

  return 'continue';
}
```

**理由**：
- 三级检查：任务列表 -> 下一个任务 -> 依赖关系
- 提前发现问题，避免执行到一半卡住
- 详细的日志记录，便于排查

### 5. Socket 事件优化

**决策**：确保 TaskExecutor 发送的事件符合新协议

**实现**：
```typescript
async executeTask(...) {
  // 1. 发送 tool:message:start
  this.socketGateway.emitToolStart(sessionId, {
    id: `task_${task.id}`,
    role: 'assistant',
    kind: 'tool',
    status: 'in_progress',
    toolName: task.type,
    title: task.description,
    // ...
  });

  try {
    // 2. 执行任务
    const result = await this.doExecute(task, context);

    // 3. 发送 tool:artifact
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: `task_${task.id}`,
      showInCanvas: true,
      artifact: result.artifact,
    });

    // 4. 发送 tool:message:complete
    this.socketGateway.emitToolUpdate(sessionId, {
      id: `task_${task.id}`,
      status: 'completed',
      artifactIds: [result.artifactId],
    });

    return { success: true, result };
  } catch (error) {
    // 5. 发送失败状态
    this.socketGateway.emitToolUpdate(sessionId, {
      id: `task_${task.id}`,
      status: 'failed',
      error: error.message,
    });

    return { success: false, error };
  }
}
```

**理由**：
- 完整的事件生命周期：start -> artifact -> complete
- 符合新的 Socket 协议规范
- 前端可以正确显示任务进度和结果

## Risks / Trade-offs

### Risk 1: artifacts 数组无限增长
**风险**：每次执行都追加 artifacts，长时间运行会占用大量内存

**缓解措施**：
- 只保留最近 10 个 artifacts 在内存中
- 旧的 artifacts 从 Redis 获取
- 添加 artifacts 清理逻辑

### Risk 2: 重试导致执行时间过长
**风险**：失败任务重试 3 次，可能让用户等待过久

**缓解措施**：
- 通过 Socket 事件实时推送重试状态
- 显示剩余重试次数
- 提供"跳过当前任务"的用户控制选项

### Risk 3: 循环依赖导致死锁
**风险**：动态添加任务时可能形成循环依赖

**缓解措施**：
- 在 `TaskSchedulerService` 中添加循环依赖检测
- 使用深度优先搜索（DFS）检测环
- 发现循环依赖时自动中断并记录日志

## Migration Plan

### 阶段 1: 修复核心逻辑（不破坏现有功能）
1. 修复 `createFallbackTaskList` 的依赖关系构建
2. 修复 `executorNode` 的 artifacts 传递
3. 添加单元测试验证修复

### 阶段 2: 增强错误处理
1. 实现重试逻辑
2. 实现跳过逻辑
3. 实现降级逻辑
4. 添加集成测试

### 阶段 3: 优化监控和日志
1. 添加详细日志
2. 添加性能统计
3. 添加错误告警
4. 更新文档

### 回滚计划
- 如果修复引入新问题，可以通过 Git revert 快速回滚
- Redis 中的任务数据保持兼容，不影响已存储的数据
- 前端无需改动，降低回滚风险

## Open Questions

1. **Q**: 是否需要持久化任务重试历史？
   **A**: 暂不需要，只在内存中记录重试次数。后续可以添加到 task.metadata

2. **Q**: 如何定义"关键任务"和"非关键任务"？
   **A**: 在 task.metadata 中添加 `critical: boolean` 字段。默认 `GENERATE_SLIDES` 是关键任务，其他是非关键

3. **Q**: 是否需要支持用户手动干预任务执行？
   **A**: 不在此次修复范围。后续可以添加 WebSocket 事件让用户控制任务跳过/重试

4. **Q**: artifacts 清理策略是什么？
   **A**: 设置 TTL 为 24 小时。超过 24 小时的 artifacts 自动过期删除
