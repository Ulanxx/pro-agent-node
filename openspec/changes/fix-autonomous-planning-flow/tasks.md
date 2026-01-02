# 实施任务清单

## 1. 问题诊断与验证
- [ ] 1.1 创建测试用例，复现任务执行中断的场景
- [ ] 1.2 添加详细日志到关键节点（planner、scheduler、executor、reflector）
- [ ] 1.3 运行测试并记录完整的执行流程和失败点
- [ ] 1.4 确认根本原因（依赖关系、artifacts 传递、错误处理）

## 2. 修复任务依赖关系构建
- [ ] 2.1 修改 `PlannerService.createFallbackTaskList()` 中的依赖关系构建逻辑
- [ ] 2.2 将索引引用改为使用实际 task ID
- [ ] 2.3 确保所有任务都有正确的 dependencies 数组
- [ ] 2.4 编写单元测试验证依赖关系正确性

## 3. 完善 artifacts 传递链
- [ ] 3.1 修改 `AutonomousGraphService.executorNode()` 方法
- [ ] 3.2 在任务执行成功后，将新 artifact 添加到 state.artifacts
- [ ] 3.3 更新 `TaskSchedulerService` 中的 `getNextTask()` 方法，确保能获取到最新的 artifacts
- [ ] 3.4 修改 `TaskExecutorService` 中所有执行方法，确保返回 artifactId
- [ ] 3.5 编写集成测试验证 artifacts 在任务间正确传递

## 4. 增强错误恢复机制
- [ ] 4.1 在 `TaskSchedulerService` 中添加 `retryFailedTask()` 方法
- [ ] 4.2 在 `TaskExecutorService` 中添加重试计数逻辑
- [ ] 4.3 在 `AutonomousGraphService.decideNextStep()` 中添加失败任务检查
- [ ] 4.4 对于关键任务失败，支持自动重试（最多 3 次）
- [ ] 4.5 对于非关键任务，支持跳过并继续执行
- [ ] 4.6 添加降级逻辑，当 AI 调用失败时使用 mock 数据

## 5. 修复状态检查逻辑
- [ ] 5.1 修改 `AutonomousGraphService.decideNextStep()` 方法
- [ ] 5.2 添加 artifacts 完整性检查
- [ ] 5.3 确保有前置依赖的任务能够获取到所需的 artifacts
- [ ] 5.4 添加任务列表状态验证（检查循环依赖）

## 6. 优化 Socket 事件
- [ ] 6.1 审查 `TaskExecutorService` 中发送的 Socket 事件
- [ ] 6.2 确保 `emitToolStart`、`emitToolUpdate` 与新协议兼容
- [ ] 6.3 添加 `tool:message:complete` 事件发送
- [ ] 6.4 在任务失败时发送错误状态事件

## 7. 增强日志和监控
- [ ] 7.1 在 `AutonomousGraphService` 的每个节点添加详细日志
- [ ] 7.2 记录任务状态转换（PENDING -> IN_PROGRESS -> COMPLETED/FAILED）
- [ ] 7.3 记录 artifacts 的创建和传递
- [ ] 7.4 添加关键路径的执行时间统计
- [ ] 7.5 添加任务失败时的堆栈跟踪

## 8. 测试和验证
- [ ] 8.1 编写端到端测试，验证完整的 6 阶段流程
- [ ] 8.2 测试任务重试逻辑
- [ ] 8.3 测试任务跳过逻辑
- [ ] 8.4 测试 AI 失败时的降级逻辑
- [ ] 8.5 测试 artifacts 在任务间的正确传递
- [ ] 8.6 测试并发场景下的任务调度
- [ ] 8.7 压力测试（模拟多个任务同时执行）
- [ ] 8.8 验证 Socket 事件的正确性

## 9. 文档更新
- [ ] 9.1 更新 `ai-autonomous-planning-implementation-summary.md`
- [ ] 9.2 添加故障排查指南
- [ ] 9.3 添加任务执行流程图
- [ ] 9.4 更新 API 文档，说明新增的重试和跳过逻辑

## 10. 代码清理和优化
- [ ] 10.1 移除调试代码
- [ ] 10.2 优化日志级别（ERROR/WARN/INFO/DEBUG）
- [ ] 10.3 统一错误消息格式
- [ ] 10.4 代码格式化和 lint 检查
- [ ] 10.5 添加代码注释说明关键逻辑
