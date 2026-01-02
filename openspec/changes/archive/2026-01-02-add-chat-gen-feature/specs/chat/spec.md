## ADDED Requirements

### Requirement: Conversational Generation
系统 SHALL 支持通过 WebSocket 进行实时对话，用户 MUST 能够发送文本指令，系统则返回规划状态和生成的 PPT 物料。

#### Scenario: User sends a topic via chat
- **WHEN** user sends a message "Help me create a PPT about AI"
- **THEN** system emits a `chat:status` with "planning"
- **AND** system eventually emits `chat:message` with the finalized outline

### Requirement: Streaming Progress Feedback
对话过程中，系统 SHALL 实时推送进度更新（百分比和描述），以便用户了解当前处于 Planning 还是 Content Generation 阶段。

#### Scenario: Real-time progress update
- **WHEN** Agent starts the planning stage
- **THEN** system emits `chat:progress` with `progress: 20` and `message: "Planning structure..."`
