## MODIFIED Requirements

### Requirement: Task Plan Synchronization
系统 SHALL 支持 Agent 执行计划的实时同步，这些同步必须由 AI 的实际执行状态驱动。

#### Scenario: Dynamic plan generation
- **WHEN** Agent 接收到任务
- **THEN** 首先通过 LLM 生成一份包含多个子任务的任务列表，并将其作为初始 `plan:update` 发送，所有初始状态为 `pending`

#### Scenario: Real-time execution status tracking
- **WHEN** Agent 决定执行某个子任务
- **THEN** 自动发送 `plan:update` 将该任务状态改为 `in_progress`，并在完成后改为 `completed`
- **AND** 之前的硬编码状态转换（如在 `ChatService` 中手动调用）将被移除

### Requirement: Structured Tool Artifacts
系统 SHALL 在工具真实执行产生数据时，将其作为 Artifact 实时推送到前端。

#### Scenario: Real search data flow
- **WHEN** `WebSearch` 工具获取到真实结果
- **THEN** 推送 `tool:artifact`，其中包含真实的网页标题、链接和摘要，而非 mock 数据
