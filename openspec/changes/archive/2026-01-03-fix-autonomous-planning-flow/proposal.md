# Change: 修复 Autonomous Planning 无法完整执行流程的问题

## Why
当前的自主规划（Autonomous Planning）模式存在多个问题导致无法跑完整个流程：

1. **任务依赖关系构建错误**：在 `createFallbackTaskList` 中，任务依赖关系通过索引引用（`tasks[0].id`），但在动态生成任务时这些索引已经无效
2. **状态检查逻辑缺陷**：`decideNextStep` 方法检查待执行任务时，没有正确更新 artifacts 数组，导致后续任务无法获取前置任务的产物
3. **Socket 事件同步缺失**：TaskExecutor 执行任务时发送的 Socket 事件（`tool:start`、`tool:update`）与新的协议不完全兼容
4. **错误处理不充分**：当某个任务失败时，缺乏重试和降级机制，直接导致整个流程中断
5. **artifacts 传递问题**：executor 中的 `context.artifacts` 在每次执行后没有更新，后续任务无法获取前置任务的产出

## What Changes

### 核心修复
- **修复任务依赖关系**：将 `createFallbackTaskList` 中的依赖关系改为使用实际的 task ID 而非索引
- **完善 artifacts 传递链**：在每个任务执行完成后，将新产生的 artifact 添加到 state.artifacts 数组
- **增强错误恢复机制**：
  - 失败任务支持自动重试（最多 3 次）
  - 对于非关键任务，支持跳过并继续执行后续任务
  - 添加降级逻辑，当 AI 调用失败时使用 mock 数据
- **修复状态检查逻辑**：在 `decideNextStep` 中检查任务状态时，同时检查 artifacts 是否完整
- **优化 Socket 事件**：确保 TaskExecutor 发送的事件与 `tool:message:start`、`tool:message:update`、`tool:message:complete` 协议兼容

### 改进点
- 添加更详细的日志记录，便于追踪任务执行流程
- 在每个节点执行前后发送状态更新的 Socket 事件
- 支持从中断点恢复执行（通过 checkpointer）
- 添加任务执行超时控制（每个任务最多 5 分钟）

## Impact

### Affected Specs
- `agent-interaction` - 更新自主规划流程的错误处理和状态管理要求

### Affected Code
- `src/modules/agent/graph/autonomous-graph.service.ts` - 修复 artifacts 传递和状态检查逻辑
- `src/modules/agent/planner/planner.service.ts` - 修复 fallback 任务列表的依赖关系构建
- `src/modules/agent/executor/task-executor.service.ts` - 改进错误处理和 Socket 事件
- `src/modules/agent/scheduler/task-scheduler.service.ts` - 增强重试和跳过逻辑
- `src/modules/agent/chat.service.ts` - 添加自主规划模式的降级开关

### Migration
- 无需数据库迁移
- Redis 中存储的任务历史数据保持兼容
- 前端无需改动（主要修复后端逻辑）
