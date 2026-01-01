## 1. Tool Implementation
- [x] 1.1 创建 `src/modules/agent/tools/web-search.tool.ts`，集成 Tavily/SerpApi
- [x] 1.2 在 `ArtifactService` 中增加对 `search_result` 内容的处理逻辑
- [x] 1.3 编写工具单元测试，确保能获取真实数据

## 2. Agent Service Refactoring (AI-Driven)
- [x] 2.1 修改 `AgentService.planDocument`，使其返回符合 `plan:update` 结构的子任务列表
- [x] 2.2 实现 Agent 执行循环（或使用 LangChain AgentExecutor），在步骤切换时触发状态回调
- [x] 2.3 移除 `ChatService.handleMessage` 中的硬编码 `setTimeout` 和 `t1-t4` 任务列表

## 3. Integration & Data Flow
- [x] 3.1 在 `ChatService` 中集成 Agent 回调，将 AI 内部的状态转换实时转发至 `SocketGateway`
- [x] 3.2 确保 `WebSearch` 工具产生的 ID 在整个生命周期内保持稳定，以支持点击跳转

## 4. Validation & Testing
- [x] 4.1 使用真实主题（如 "Apple Vision Pro 2 传闻"）运行 `test-chat-flow.js`
- [x] 4.2 验证 `Plan Update` 中的任务内容是动态生成的，而非固定的四个步骤
- [x] 4.3 检查 `tool:artifact` 中的数据真实性
