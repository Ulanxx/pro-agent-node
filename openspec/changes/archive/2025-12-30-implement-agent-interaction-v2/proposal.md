# Change: Implement Agent Interaction v2

## Why
根据 `docs/change-02.md` 文档，系统需要增强 Agent 的交互流程，包括任务规划（Plan）的流式同步、工具产物（Artifacts）的实时生成以及完成状态的自动联动。这不仅提升了用户体验，还加强了前端对 Agent 执行过程的可视化能力。

## What Changes
- **ADDED**: `plan:update` 事件，用于同步 Agent 的任务规划和 Todo List 状态。
- **ADDED**: `tool:artifact` 事件，用于在工具调用产生结果时实时推送到前端。
- **MODIFIED**: `tool:log` 事件，增加 `artifactId` 关联，支持点击查看产物。
- **MODIFIED**: `completion` 事件，增加 `finalArtifactId` 以支持自动展示最终结果。
- **ADDED**: 定义一套标准的产物类型（Artifact Types）及其数据结构。

## Impact
- **Affected specs**: `agent-interaction` (new), `socket-communication` (modified in previous change, need consolidation)
- **Affected code**: 
    - `src/modules/socket/socket.gateway.ts` (Socket 事件定义与分发)
    - `src/modules/agent/agent.service.ts` (Agent 执行逻辑与事件触发)
    - `src/core/dsl/` (可能涉及产物 DSL 的 Schema 定义)
