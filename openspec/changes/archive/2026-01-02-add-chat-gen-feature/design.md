# Design: Chat Gen with Artifacts (Manus-style)

## Context
用户希望将 AnyGenAgent 演进为一个类似 Manus 的对话式智能体应用。用户通过聊天界面描述需求，Agent 自动规划并生成 PPT 物料（Artifacts），用户可以在右侧实时预览这些物料及其演进过程。

## Goals
- 实现对话式交互，支持流式输出和状态反馈。
- 实现 "Artifacts" 概念，将 PPT DSL、渲染后的文件等作为独立的产物进行管理。
- 提供分屏布局：左侧聊天，右侧产物预览。
- 支持物料规划的动态展示。

## Decisions
- **Communication Protocol**: 使用 Socket.io 进行实时双向通信，支持 `chat:message`、`chat:progress`、`artifact:update` 等事件。
- **State Management**: 使用 Redis 存储对话上下文和 Artifact 状态，实现无状态服务的水平扩展。
- **Artifact Versioning**: 每个生成的 PPT 或 DSL 都是一个 Artifact 版本，用户可以回溯或在基础上修改。
- **UI Framework**: 建议使用 React + TailwindCSS + Shadcn/ui（前端部分虽然不在本阶段实现，但在设计中预留接口）。

## Risks / Trade-offs
- **Latency**: 多阶段生成（Planning -> Content -> Rendering）会导致响应延迟，需要通过细粒度的进度推送缓解焦虑。
- **Context Window**: 复杂的 PPT 生成可能消耗大量上下文，需优化 Prompt 和 Context 管理。

## Migration Plan
- 保持现有 `/generate` API 兼容。
- 逐步将业务逻辑迁移到基于 Socket.io 的对话模式。
- 引入 `Artifact` 实体类管理生成产物。
