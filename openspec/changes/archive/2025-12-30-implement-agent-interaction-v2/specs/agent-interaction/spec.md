## ADDED Requirements

### Requirement: Task Plan Synchronization
系统 SHALL 支持 Agent 执行计划的实时同步，以便前端展示任务进度。

#### Scenario: Initial plan broadcast
- **WHEN** Agent 开始处理请求并完成初步规划
- **THEN** 发送 `plan:update` 事件，包含所有任务及其初始状态 `pending`

#### Scenario: Task status update
- **WHEN** Agent 开始执行某个特定任务或完成任务
- **THEN** 发送 `plan:update` 事件，更新对应任务的状态为 `in_progress` 或 `completed`

### Requirement: Structured Tool Artifacts
系统 SHALL 在工具执行产生结构化数据时，将其作为 Artifact 实时推送到前端。

#### Scenario: Search tool output
- **WHEN** Agent 调用搜索工具并获得结果
- **THEN** 发送 `tool:artifact` 事件，其中 `type` 为 `search_result`，并包含格式化的结果列表

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
