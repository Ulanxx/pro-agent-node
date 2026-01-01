## 1. Backend Implementation
- [x] 1.1 更新 `AgentService` 中的 6 阶段 Workflow 定义
- [x] 1.2 重构 `SocketGateway` 移除旧的 `thought:update` 发送逻辑
- [x] 1.3 确保每个阶段的 `tool:artifact` 负载符合新的 Schema
- [x] 1.4 在 `generate_slides` 任务中增加 `progress` 事件推送
- [x] 1.5 编写集成测试校验 6 阶段事件序列

## 2. Shared/Contract Validation
- [x] 2.1 同步 `data.json` 为最新的 6 阶段参考数据
- [x] 2.2 验证前后端对 `artifactId` 的引用一致性
- [ ] 2.2 验证前后端对 `artifactId` 的引用一致性
