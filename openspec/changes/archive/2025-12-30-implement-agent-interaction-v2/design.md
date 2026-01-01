## Context
目前的 Agent 交互主要依赖消息块和简单的思考更新。用户无法直观看到 Agent 的长期规划，工具产物也缺乏结构化的呈现方式。

## Goals
- 提供透明的任务进度（Todo List）。
- 实时展示工具生成的中间产物（如搜索结果、网页快照）。
- 实现思考步骤、日志与产物之间的深度联动。

## Decisions

### 1. Artifact Identity Management
- **Decision**: 每个产物（Artifact）在生成时必须分配一个唯一且稳定的 `id`。
- **Rationale**: 这样 `tool:log` 和 `completion` 才能准确地引用这些产物，实现前端的跳转和联动。

### 2. Plan Synchronization Strategy
- **Decision**: 采用全量更新模式发送 `plan:update`。
- **Rationale**: 任务列表通常较短，全量更新可以简化前后端的状态同步逻辑，避免增量更新带来的复杂性。

### 3. Artifact Types Extensibility
- **Decision**: 在服务端定义统一的 `ArtifactType` 枚举和对应的 Content 结构。
- **Rationale**: 确保不同工具产生的输出具有一致的结构，方便前端渲染器（Canvas）进行适配。

## Risks / Trade-offs
- **Risk**: 频繁的 `plan:update` 可能造成 Socket 流量压力。
- **Mitigation**: 仅在任务状态发生实质性变化（pending -> in_progress -> completed）时触发更新。
