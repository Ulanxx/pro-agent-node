# Change: Implement AI-Driven WebSearch Tool and Dynamic Planning

## Why
目前 Agent 的交互流程（任务规划同步、工具调用逻辑）大部分是硬编码在 `ChatService` 中的 mock 逻辑。为了实现真正的自主性，系统需要：
1.  **真实的 WebSearch 工具**：通过集成外部 API (如 Tavily 或 SerpApi) 提供真实的互联网搜索能力。
2.  **AI 驱动的任务执行**：任务的状态流转（`pending` -> `in_progress` -> `completed`）应当由 Agent 的实际执行步骤驱动，而非硬编码的延迟。
3.  **结构化数据驱动**：工具产生的产物（Artifacts）应当来自真实的执行结果，以提供有价值的信息。

## What Changes
- **NEW**: `WebSearch` 工具实现，集成真实的搜索服务。
- **MODIFIED**: `AgentService` 架构，支持自主决策何时调用工具，并实时反馈执行状态。
- **MODIFIED**: `ChatService` 移除硬编码的任务列表和工具模拟逻辑。
- **NEW**: 完善 `agent-interaction` 规范，定义工具调用的标准生命周期和产物格式。

## Impact
- **Affected specs**: `agent-interaction` (modified), `web-search-tool` (new)
- **Affected code**: 
    - `src/modules/agent/agent.service.ts` (增加工具调用循环)
    - `src/modules/agent/chat.service.ts` (解耦 mock 逻辑)
    - `src/modules/agent/tools/` (新增工具目录)
