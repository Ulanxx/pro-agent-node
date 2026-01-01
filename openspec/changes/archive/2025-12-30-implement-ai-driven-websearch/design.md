## Context
当前的交互是线性且硬编码的。我们需要一个能够根据用户目标自主拆解任务、调用工具并实时同步进度的 Agent 系统。

## Goals
- 实现一个可被 AI 调用的 `WebSearch` 工具。
- 让 Agent 能够根据任务进度动态发送 `plan:update`。
- 工具执行结果自动转化为 `Artifact` 并推送到前端。

## Decisions

### 1. Tool Integration Pattern
- **Decision**: 使用 LangChain 的 `StructuredTool` 或自定义 Tool 接口。
- **Rationale**: 方便扩展更多工具（如 Browser, Python Interpreter），且能自动生成 AI 可理解的工具描述。

### 2. Autonomous Planning & Status Sync
- **Decision**: 引入一个执行循环（Execution Loop），在每个步骤开始前由 Agent 决定当前正在执行哪个任务，并触发 `plan:update`。
- **Rationale**: 确保前端看到的进度与后端真实的 AI 思考/执行过程 100% 同步。

### 3. Search Provider
- **Decision**: 优先支持 `Tavily` 作为搜索引擎（或 `SerpApi`）。
- **Rationale**: Tavily 专门为 AI 优化，返回的内容更适合作为上下文，且能直接输出结构化摘要。

## Risks / Trade-offs
- **Risk**: 真实搜索可能带来额外的延迟和 API 成本。
- **Mitigation**: 增加缓存机制，并在 `design.md` 中明确工具调用的配额。
