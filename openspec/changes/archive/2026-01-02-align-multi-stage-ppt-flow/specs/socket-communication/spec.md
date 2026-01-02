## MODIFIED Requirements

### Requirement: Progress Event with Artifact ID
后端在发送 `progress` 事件时，如果该进度对应某个特定产物，SHALL 包含 `artifactId`。

#### Scenario: Phase 6 progress tracking
- **WHEN** 进入 `generate_slides` 阶段
- **THEN** 每生成一页 PPT，发送一次 `progress` 事件，包含当前的 `progress` (0-100) 和 `artifactId`
- **AND** 之前的阶段（1-5）不应发送 `progress` 事件，而应通过 `tool:update` 状态来驱动 UI

### Requirement: Thought Update Event
后端 SHALL 通过 `tool:start` 和 `tool:update` 替代旧的 `thought:update` 事件推送思考逻辑。

#### Scenario: Unified tool lifecycle
- **WHEN** 工具开始执行
- **THEN** 发送 `tool:start` 包含 `id`, `toolName`, `title`, `status: 'in_progress'`
- **WHEN** 工具执行成功并产生结果
- **THEN** 发送 `tool:update` 包含 `id`, `status: 'completed'`, `artifactIds: [...]`
