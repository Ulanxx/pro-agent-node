# Tasks: Optimize Socket.io Communication Protocol

- [x] **Phase 1: 协议对齐分析**
    - [x] 分析 `ChatService` 中如何触发消息推送，确保支持流式输出。
    - [x] 确认 `plan:start` 和 `plan:update` 是否可以被 `tool:artifact` 和 `thought:update` 完全替代。
- [x] **Phase 2: 接口定义更新**
    - [x] 在 `socket.gateway.ts` 中新增 `emitMessageStart` 和 `emitMessageChunk`。
    - [x] 修改 `handleChatInit` 以返回 `chat:init:response`。
    - [x] 更新 `emitThoughtUpdate` 和 `emitToolLog` 的数据结构。
- [x] **Phase 3: 逻辑迁移**
    - [x] 调整 `ChatService` 中的调用点，使用新的 `emit` 方法。
    - [x] 将原有的 `emitPlanStart` 逻辑重构为发送 `message:start` + `thought:update` 或 `tool:artifact`。
- [x] **Phase 4: 验证**
    - [x] 验证端到端通信流程是否符合文档示例流程。
