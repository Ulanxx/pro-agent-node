# agent-interaction Specification

## Purpose
TBD - created by archiving change implement-agent-interaction-v2. Update Purpose after archive.
## Requirements
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

### Requirement: Artifact Visualization Control
系统 SHALL 能够控制产物是否在前端画布中自动获得焦点。

#### Scenario: Auto-focus on important artifact
- **WHEN** 发送 `tool:artifact` 且设置 `showInCanvas: true`
- **THEN** 前端应当自动切换右侧画布显示该产物

### Requirement: Enhanced Tool Logging
后端在发送 `tool:log` 事件时，SHALL 可选地包含 `artifactId` 以实现产物联动。

#### Scenario: Log with artifact link
- **WHEN** 工具执行产生了一个可以被查看的产物
- **THEN** 发送的日志 Payload 中包含 `artifactId`，以便前端显示“查看”按钮

### Requirement: Enhanced Task Completion
系统在发送 `completion` 事件时，SHALL 支持包含 `finalArtifactId` 以指向最终交付物。

#### Scenario: Success completion with final result
- **WHEN** 任务成功完成且生成了最终产物（如 PPTX 文件）
- **THEN** 发送 `{ "success": true, "finalArtifactId": "..." }`

