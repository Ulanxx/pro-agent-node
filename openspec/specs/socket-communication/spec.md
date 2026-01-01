# socket-communication Specification

## Purpose
TBD - created by archiving change update-socket-artifact-linking. Update Purpose after archive.
## Requirements
### Requirement: Progress Event with Artifact ID
后端在发送 `progress` 事件时，如果该进度对应某个特定产物，SHALL 包含 `artifactId`。

#### Scenario: Progress update with artifact link
- **WHEN** 后端正在生成特定页面产物
- **THEN** 发送 `{ "status": "GENERATING", "progress": 50, "artifactId": "slide_1" }`

### Requirement: Thought Update Event
后端 SHALL 通过 `thought:update` 事件推送思考逻辑，并支持与产物绑定。

#### Scenario: Thought step completion with artifact link
- **WHEN** 后端完成一个思考步骤，且该步骤产出了一个 Artifact
- **THEN** 发送 `{ "messageId": "msg_1", "thought": { "id": "t_1", "status": "completed", "artifactId": "slide_1" } }`

### Requirement: Artifact Update Consistency
后端在发送 `artifact:update` 时，其 `id` SHALL 与 `progress` 或 `thought:update` 中引用的 `artifactId` 一致。

#### Scenario: Consistent artifact ID
- **WHEN** 后端推送产物内容
- **THEN** `id` 字段必须匹配之前在进度或思考中预告的 `artifactId`

