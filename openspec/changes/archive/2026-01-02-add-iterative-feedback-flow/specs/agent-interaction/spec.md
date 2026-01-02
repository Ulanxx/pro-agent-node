## ADDED Requirements

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
