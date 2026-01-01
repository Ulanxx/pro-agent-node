## ADDED Requirements

### Requirement: Artifact Management
系统 SHALL 将生成的 PPT DSL 和渲染后的文件作为 "Artifact" 进行管理。每个 Artifact MUST 包含 ID、类型（dsl/pptx）、内容或下载链接以及版本信息。

#### Scenario: New artifact created
- **WHEN** Agent completes a generation stage (Planning or Content)
- **THEN** system emits `artifact:update` with the new content
- **AND** system SHALL store the artifact in Redis for session persistence

### Requirement: Split-screen UI Support (Backend)
后端 SHALL 支持返回分屏交互所需的数据结构，使得前端 MUST 能够同时展示对话流和产物预览区。

#### Scenario: Fetching current artifacts
- **WHEN** user reconnects to a session
- **THEN** system SHALL return the list of all active artifacts for that session
