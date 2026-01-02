## ADDED Requirements

### Requirement: 统一会话初始化响应
Server SHALL 通过 `chat:init:response` 事件响应客户端的 `chat:init`。

#### Scenario: 客户端初始化成功
- **WHEN** 客户端发送 `chat:init` 事件包含有效的 `sessionId`
- **THEN** 服务端发送 `chat:init:response` 事件，Payload 包含 `status: "success"` 和 `artifacts` 数组

### Requirement: 引入流式消息事件
Server SHALL 使用 `message:start` 和 `message:chunk` 来推送助手的回复。

#### Scenario: 助手开始回复
- **WHEN** 助手准备好生成内容
- **THEN** 发送 `message:start` 事件包含消息 `id`

#### Scenario: 助手生成文本片段
- **WHEN** 助手生成一段文本
- **THEN** 发送 `message:chunk` 事件包含消息 `id` 和文本 `chunk`

### Requirement: 规范产物发送
所有生成的结构化内容（如计划、PPT、网页）SHALL 通过 `tool:artifact` 事件发送。

#### Scenario: 生成任务计划
- **WHEN** 助手规划任务
- **THEN** 发送 `tool:artifact` 事件，其 `artifact.type` 为 `"plan"`

## MODIFIED Requirements

### Requirement: Thought Update Event
后端 SHALL 通过 `thought:update` 事件推送思考逻辑，并支持与产物绑定。更新后的结构必须符合前端对接文档。

#### Scenario: Thought step completion with artifact link
- **WHEN** 后端完成一个思考步骤，且该步骤产出了一个 Artifact
- **THEN** 发送 `{ "messageId": "msg_1", "thought": { "id": "t_1", "status": "completed", "artifactId": "slide_1" } }`
