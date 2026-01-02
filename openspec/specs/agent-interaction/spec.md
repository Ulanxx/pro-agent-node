# agent-interaction Specification

## Purpose
TBD - created by archiving change implement-agent-interaction-v2. Update Purpose after archive.
## Requirements
### Requirement: Task Plan Synchronization
系统 SHALL 支持 Agent 执行计划的实时同步，这些同步必须由 AI 的实际执行状态驱动。

#### Scenario: 6-stage flow execution
- **WHEN** Agent 接收到 PPT 生成任务
- **THEN** 必须严格遵循 6 个原子步骤：analyze_topic -> generate_course_config -> generate_video_outline -> generate_slide_scripts -> generate_presentation_theme -> generate_slides
- **AND** 每个步骤开始前必须发送 `tool:start`，结束前发送 `tool:artifact` 和 `tool:update`

### Requirement: Structured Tool Artifacts
系统 SHALL 在工具真实执行产生数据时，将其作为 Artifact 实时推送到前端。

#### Scenario: Real search data flow
- **WHEN** `WebSearch` 工具获取到真实结果
- **THEN** 推送 `tool:artifact`，其中包含真实的网页标题、链接和摘要，而非 mock 数据

#### Scenario: PPT generation artifacts
- **WHEN** PPT 生成流程的任一阶段完成
- **THEN** 推送对应类型的 Artifact（`course_config`、`video_outline`、`slide_scripts`、`presentation_theme`、`dsl`）
- **AND** Artifact 的 `type` 字段必须在 `ArtifactSchema` 的枚举中定义

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

### Requirement: Iterative Feedback Loop
系统 SHALL 支持在 PPT 生成完成后，识别用户反馈意图并自动重新触发特定阶段的优化。

#### Scenario: Visual refinement feedback
- **WHEN** 用户反馈“增加配图”或“视觉优化”相关意见
- **THEN** 系统识别为 `REFINEMENT` 意图，并定位到 `stageSlideGeneration` 阶段
- **AND** 使用用户反馈作为额外 Prompt 重新生成 PPT 页面

#### Scenario: Content structure refinement feedback
- **WHEN** 用户反馈“大纲太复杂”或“内容缩减”相关意见
- **THEN** 系统识别为 `REFINEMENT` 意图，并定位到 `stageVideoOutline` 阶段
- **AND** 重新执行该阶段及其所有下游阶段（脚本生成、主题、页面生成）

### Requirement: Intent Classification Logic
系统 SHALL 在处理消息前，根据会话历史判断用户是在发起新任务还是针对现有产物提出修改意见。

#### Scenario: New request identification
- **WHEN** 用户发送与当前上下文无关或明确的新主题请求
- **THEN** 识别为 `INITIAL` 意图，启动完整的 5 阶段流程

#### Scenario: Refinement request identification
- **WHEN** 会话中已存在产物且用户发送针对性修改指令
- **THEN** 识别为 `REFINEMENT` 意图，并提取目标阶段

### Requirement: Graph-based Workflow Execution
The system SHALL execute the PPT generation process using a structured state graph (LangGraph) to ensure consistent state transitions and modularity.

#### Scenario: Successful full-graph execution
- **WHEN** a topic is provided to the agent graph
- **THEN** it must traverse all nodes from analysis to slide generation and produce a valid PptHtmlDocument

### Requirement: State Persistence and Recovery
The system SHALL persist the execution state of the graph at each node boundary, allowing the workflow to be resumed from the last successful node in case of interruptions.

#### Scenario: Resume after interruption
- **WHEN** the generation process stops after the "courseConfig" stage
- **THEN** the system MUST be able to resume execution from the "videoOutline" stage without re-running previous stages

### Requirement: Node-level Progress Reporting
The system SHALL emit progress notifications via Socket.io as it enters and completes each node in the graph.

#### Scenario: Socket notification on node start
- **WHEN** the "analysis" node starts execution
- **THEN** a "tool:start" or "progress" event must be emitted to the client

### Requirement: 5-Stage PPT Generation Pipeline
系统 MUST 支持确定的 5 阶段 PPT 生成流程，每个阶段产生独立的 Artifact 并实时推送进度。

#### Scenario: Stage 1 - Course Configuration Generation
- **WHEN** Agent 开始处理 PPT 生成任务
- **THEN** 首先生成课程配置（叙事风格、目标受众、时长、教学目标）
- **AND** 推送 `tool:artifact` 包含 `type: 'course_config'` 的 Artifact

#### Scenario: Stage 2 - Video Outline Generation
- **WHEN** 课程配置生成完成
- **THEN** 基于课程配置生成讲解视频大纲（主题、知识单元、知识点层级结构）
- **AND** 推送 `tool:artifact` 包含 `type: 'video_outline'` 的 Artifact

#### Scenario: Stage 3 - Slide Scripts Generation
- **WHEN** 视频大纲生成完成
- **THEN** 为每一页 PPT 生成完整脚本（幻灯片内容设计、可视化建议、口播稿）
- **AND** 推送 `tool:artifact` 包含 `type: 'slide_scripts'` 的 Artifact，内容为脚本数组

#### Scenario: Stage 4 - Presentation Theme Generation
- **WHEN** PPT 脚本生成完成
- **THEN** 生成 PPT 主题风格和母版配置（主题名称、颜色方案、字体配置、母版布局）
- **AND** 推送 `tool:artifact` 包含 `type: 'presentation_theme'` 的 Artifact

#### Scenario: Stage 5 - Iterative Slide Generation
- **WHEN** 主题和脚本都已生成
- **THEN** 循环遍历 PPT 脚本数组，逐页生成 PPT 页面
- **AND** 每生成一页推送进度更新，包含当前页码和总页数
- **AND** 最终推送完整的 `AnyGenDocument` 作为 `type: 'dsl'` Artifact

### Requirement: Course Configuration DSL
系统 MUST 定义 `CourseConfig` DSL Schema，用于描述课程元信息。

#### Scenario: Course config structure validation
- **WHEN** LLM 生成课程配置
- **THEN** 输出必须包含 `narrativeStyle`（叙事风格）、`targetAudience`（目标受众）、`duration`（时长）、`objectives`（教学目标）字段
- **AND** 通过 Zod Schema 验证

### Requirement: Video Outline DSL
系统 MUST 定义 `VideoOutline` DSL Schema，用于描述讲解视频的层级结构。

#### Scenario: Video outline structure validation
- **WHEN** LLM 生成视频大纲
- **THEN** 输出必须包含 `theme`（主题）和 `knowledgeUnits`（知识单元数组）
- **AND** 每个知识单元包含 `title`、`description` 和 `knowledgePoints`（知识点数组）
- **AND** 通过 Zod Schema 验证

### Requirement: Slide Script DSL
系统 MUST 定义 `SlideScript` DSL Schema，用于描述单页 PPT 的完整脚本。

#### Scenario: Slide script structure validation
- **WHEN** LLM 生成 PPT 脚本数组
- **THEN** 每个脚本必须包含 `slideIndex`（页码）、`contentDesign`（内容设计）、`visualSuggestions`（可视化建议）、`narrationScript`（口播稿）
- **AND** 通过 Zod Schema 验证

### Requirement: Presentation Theme DSL
系统 MUST 定义 `PresentationTheme` DSL Schema，用于描述 PPT 的主题风格和母版配置。

#### Scenario: Theme structure validation
- **WHEN** LLM 生成主题配置
- **THEN** 输出必须包含 `themeName`（主题名称）、`colorScheme`（颜色方案）、`fontConfig`（字体配置）、`masterSlides`（母版配置）
- **AND** 通过 Zod Schema 验证

### Requirement: Iterative Generation Progress Tracking
系统 MUST 在逐页生成 PPT 时实时推送进度信息。

#### Scenario: Per-slide progress update
- **WHEN** 系统开始生成第 N 页 PPT
- **THEN** 发送 `progress` 事件包含 `{ "status": "generating_slide", "current": N, "total": M, "message": "正在生成第 N/M 页..." }`
- **AND** 前端可显示进度条和当前页面信息

#### Scenario: Slide generation completion
- **WHEN** 单页 PPT 生成完成
- **THEN** 可选地推送该页的预览 Artifact（如缩略图或 JSON）
- **AND** 继续生成下一页直到全部完成

### Requirement: Stage-Specific Tool Messages
系统 MUST 为每个生成阶段创建独立的 Tool Message，以便前端区分和展示。

#### Scenario: Tool message for each stage
- **WHEN** 进入新的生成阶段
- **THEN** 发送 `tool:message:start` 包含对应的 `toolName`（如 `generate_course_config`、`generate_video_outline` 等）
- **AND** 阶段完成后发送 `tool:message:complete` 并关联生成的 Artifact

