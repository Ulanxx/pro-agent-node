# socket-communication 规范增量

## REMOVED Requirements

### Requirement: Thought Update Event
**Reason**: 旧协议事件，被 tool message 机制替代
**Migration**: 使用 `tool:message:start`、`tool:message:update`、`tool:message:complete` 事件

### Requirement: Progress Event with Artifact ID
**Reason**: 该需求已被新的 tool message 机制覆盖
**Migration**: 通过 `tool:message:update` 更新 `progressText` 字段，通过 `tool:artifact` 绑定产物

### Requirement: Artifact Update Consistency
**Reason**: `artifact:update` 事件已被移除
**Migration**: 使用 `tool:artifact` 事件

## ADDED Requirements

### Requirement: Session Initialization
后端 SHALL 响应 `chat:init` 事件，返回会话历史消息和产物列表。

#### Scenario: 新会话初始化
- **WHEN** 客户端发送 `chat:init` 事件且会话不存在
- **THEN** 返回 `{ "status": "success", "messages": [], "artifacts": [] }`

#### Scenario: 恢复现有会话
- **WHEN** 客户端发送 `chat:init` 事件且会话存在
- **THEN** 返回包含历史消息和产物的响应，消息结构符合协议定义

### Requirement: Message Type Distinction
后端发送的 assistant 消息 MUST 包含 `kind` 字段以区分消息类型。

#### Scenario: 普通对话消息
- **WHEN** 后端发送普通对话内容
- **THEN** 消息包含 `kind: 'chat'` 字段

#### Scenario: 工具过程消息
- **WHEN** 后端执行工具调用
- **THEN** 消息包含 `kind: 'tool'` 字段

### Requirement: Tool Message Lifecycle
后端 SHALL 通过三阶段事件管理工具调用过程。

#### Scenario: 工具调用开始
- **WHEN** 后端开始执行工具调用
- **THEN** 发送 `tool:message:start` 事件，包含 `id`、`role`、`kind`、`status`、`toolName`、`title`、`content`、`progressText`、`timestamp` 字段

#### Scenario: 工具执行进度更新
- **WHEN** 工具执行过程中需要更新进度或状态
- **THEN** 发送 `tool:message:update` 事件，包含 `id` 和 `patch` 对象

#### Scenario: 工具调用完成
- **WHEN** 工具执行完成或失败
- **THEN** 发送 `tool:message:complete` 事件，包含 `id`、`status`（'completed' 或 'error'）、`timestamp` 字段

### Requirement: Tool Artifact Binding
后端 SHALL 通过 `tool:artifact` 事件将产物绑定到 tool message。

#### Scenario: 单个产物绑定
- **WHEN** 工具生成一个产物
- **THEN** 发送 `tool:artifact` 事件，`messageId` 指向对应的 tool message ID，包含完整的 artifact 对象

#### Scenario: 多个产物绑定
- **WHEN** 工具在执行过程中生成多个产物
- **THEN** 多次发送 `tool:artifact` 事件，每次 `messageId` 都指向同一个 tool message ID

#### Scenario: 产物立即显示
- **WHEN** 产物需要在画布区域立即显示
- **THEN** `tool:artifact` 事件的 `showInCanvas` 字段设置为 `true`

### Requirement: Message Streaming
后端 SHALL 支持流式发送 assistant 对话消息。

#### Scenario: 开始流式消息
- **WHEN** 后端开始回复用户
- **THEN** 发送 `message:start` 事件，包含 `id`、`role`、`content`（初始为空字符串）

#### Scenario: 发送消息增量
- **WHEN** 后端生成新的文本内容
- **THEN** 发送 `message:chunk` 事件，包含 `id` 和 `chunk` 字段

### Requirement: Progress Feedback
后端 SHALL 通过 `progress` 事件提供长耗时任务的进度反馈。

#### Scenario: 通用进度更新
- **WHEN** 执行长耗时任务
- **THEN** 发送 `progress` 事件，包含 `status`、`progress`（0-100）、`message` 字段

#### Scenario: 关联产物的进度
- **WHEN** 进度更新关联特定产物
- **THEN** `progress` 事件包含 `artifactId` 字段

### Requirement: Completion Signal
后端 SHALL 在整个回复流程结束时发送 `completion` 事件。

#### Scenario: 成功完成
- **WHEN** 所有处理成功完成
- **THEN** 发送 `{ "success": true, "result": {}, "finalArtifactId": "..." }`

#### Scenario: 失败完成
- **WHEN** 处理过程中发生错误
- **THEN** 发送 `{ "success": false, "error": "错误信息" }`

### Requirement: Message History Structure
后端存储的消息历史 MUST 直接符合协议定义的消息结构。

#### Scenario: 存储 user 消息
- **WHEN** 保存用户消息
- **THEN** 存储 `{ "role": "user", "content": "...", "timestamp": ... }`

#### Scenario: 存储 assistant chat 消息
- **WHEN** 保存普通对话消息
- **THEN** 存储 `{ "id": "...", "role": "assistant", "kind": "chat", "content": "...", "timestamp": ... }`

#### Scenario: 存储 assistant tool 消息
- **WHEN** 保存工具过程消息
- **THEN** 存储完整的 tool message 对象，包含所有必需字段

### Requirement: Room-based Broadcasting
后端 SHALL 使用 Socket.io room 机制向特定会话广播事件。

#### Scenario: 会话事件广播
- **WHEN** 发送会话相关事件
- **THEN** 使用 `session_${sessionId}` room 进行广播

#### Scenario: 客户端加入会话
- **WHEN** 客户端发送 `chat:init` 或 `chat:send`
- **THEN** 自动将客户端加入对应的 session room
