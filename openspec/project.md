# Project Context

## Purpose
AnyGenAgent 是一个基于 NestJS 的智能系统，旨在通过 Agentic Workflow 将自然语言提示词转化为结构化、可编辑的 PPT 文档。其核心理念是 "JSON DSL First"，即先生成平台无关的中间表示 (IR)，再通过适配器渲染为目标格式。

## Tech Stack
- **Runtime**: Node.js (LTS)
- **Framework**: NestJS v10 (Modular Architecture)
- **Language**: TypeScript 5.x (Strict Mode)
- **LLM Orchestration**: LangChain.js (`@langchain/openai`, `@langchain/core`)
- **Validation**: Zod (Source of Truth for DSL)
- **Task Queue**: BullMQ + Redis (ioredis)
- **Real-time**: Socket.io
- **Rendering**: pptxgenjs

## Project Conventions

### Code Style
- 使用 Prettier 和 ESLint 进行代码格式化。
- 遵循 NestJS 官方推荐的模块化目录结构。
- 强制使用 TypeScript 严格模式，所有 DSL 定义必须有对应的 Zod Schema。

### Architecture Patterns
- **Agentic Workflow**: 两阶段生成流程（Planning -> Content Generation）。
- **DSL-Driven**: 所有业务逻辑围绕 `AnyGenDocument` DSL 展开，实现生成与渲染的解耦。
- **Async Processing**: 耗时任务通过 BullMQ 异步处理，并通过 WebSocket 实时推送进度。

### Testing Strategy
- 使用 Jest 进行单元测试和集成测试。
- E2E 测试位于 `test/` 目录。

### Git Workflow
- 使用中文编写 Git commit message。
- 遵循功能分支开发模式。

## Domain Context
- **Layout System**: 使用百分比坐标系 (0-100) 进行布局，以便跨平台适配。
- **Component Types**: 目前支持 `text`, `image`, `chart` 三种核心组件。
- **Mock Mode**: 在缺失 `OPENAI_API_KEY` 时，系统应自动降级至 Mock 模式以保证流程可测试。

## Important Constraints
- **Redis Dependency**: 系统启动必须依赖 Redis 服务（用于 BullMQ 队列和 Agent 状态）。
- **OpenAI API Key**: 必须提供有效的 `OPENAI_API_KEY` 才能进行真实内容的生成，否则将自动回退到 Mock 逻辑。
- **Environment**: 仅支持 Node.js LTS 环境。

## External Dependencies
- **OpenAI API**: 使用 google/gemini-3-flash-preview 模型进行结构化输出生成。
- **Redis**: 存储任务队列和中间状态。
- **Socket.io**: 用于与前端建立双向实时通信。
