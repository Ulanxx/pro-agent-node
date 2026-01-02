## MODIFIED Requirements

### Requirement: Task Plan Synchronization
系统 SHALL 支持 Agent 执行计划的实时同步，这些同步必须由 AI 的实际执行状态驱动。

#### Scenario: 6-stage flow execution
- **WHEN** Agent 接收到 PPT 生成任务
- **THEN** 必须严格遵循 6 个原子步骤：analyze_topic -> generate_course_config -> generate_video_outline -> generate_slide_scripts -> generate_presentation_theme -> generate_slides
- **AND** 每个步骤开始前必须发送 `tool:start`，结束前发送 `tool:artifact` 和 `tool:update`

### Requirement: Structured Tool Artifacts
系统 SHALL 在工具真实执行产生数据时，将其作为 Artifact 实时推送到前端。

#### Scenario: Standardized artifact types
- **WHEN** 工具执行完成
- **THEN** 推送的 `tool:artifact` 必须包含对应的类型（如 `course_config`, `video_outline` 等）
- **AND** 内容结构必须符合定义好的 Zod Schema
