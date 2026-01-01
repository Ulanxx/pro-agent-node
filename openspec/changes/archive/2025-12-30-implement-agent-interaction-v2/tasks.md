## 1. Socket Protocol Enhancement
- [x] 1.1 定义 `plan:update` 事件负载结构
- [x] 1.2 定义 `tool:artifact` 事件负载结构
- [x] 1.3 增强 `tool:log` 事件，加入 `artifactId` 可选字段
- [x] 1.4 增强 `completion` 事件，加入 `finalArtifactId` 可选字段

## 2. Agent Logic Implementation
- [x] 2.1 在 Agent 启动时发送初始 `plan:update`
- [x] 2.2 在 Agent 执行步骤切换时更新 `plan:update` 状态
- [x] 2.3 在工具执行（如 Search, Browser）产生结果时触发 `tool:artifact`
- [x] 2.4 在发送工具日志时关联对应的 `artifactId`
- [x] 2.5 在任务结束时，识别并关联最终产物 ID 到 `completion` 事件

## 3. Validation & Testing
- [x] 3.1 编写单元测试验证 Socket 事件的正确触发
- [x] 3.2 使用 `test-chat-flow.js` 验证端到端交互流程
- [x] 3.3 检查前端控制台 `Socket Logs` 确保 Payload 符合文档规范
