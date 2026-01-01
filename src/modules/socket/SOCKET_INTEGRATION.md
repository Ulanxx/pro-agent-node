# AnyGen Socket.io 通信协议文档（无历史包袱版本）

本文档旨在说明前端（AnyGen Web）与后端（AnyGen Server）通过 Socket.io 进行通信的协议规范。

本版本采用“**过程型消息（tool message）**”的思路：
- 每次工具调用对应 **一条独立的 assistant 消息**（`kind: 'tool'`）
- 工具产物通过 `tool:artifact` 事件 **可多次** 绑定到该 tool message（形成多个 artifact 线索）
- 不再使用 `thought:update`、`tool:log` 这类事件；前端也不做任何历史归并

## 1. 基础信息
- **技术栈**: Socket.io
- **默认连接地址**: `http://localhost:3000` (开发环境)

## 2. 客户端发送事件 (Client -> Server)

### `chat:init`
连接建立后，客户端首先发送此事件初始化会话。
- **Payload**:
  ```json
  {
    "sessionId": "string" // 会话唯一标识符
  }
  ```

### `chat:send`
用户发送消息给助手。
- **Payload**:
  ```json
  {
    "message": "string", // 用户输入的文本内容
    "sessionId": "string" // 当前会话 ID
  }
  ```

---

## 3. 服务端发送事件 (Server -> Client)

### `chat:init:response`
响应 `chat:init`，同步会话状态、历史消息和历史产物。
- **Payload**:
  ```json
  {
    "status": "success",
    "messages": [
      {
        "role": "user",
        "content": "string",
        "timestamp": 1704000000000
      },
      {
        "id": "msg_001",
        "role": "assistant",
        "kind": "chat",
        "content": "string",
        "timestamp": 1704000001000
      },
      {
        "id": "tool_001",
        "role": "assistant",
        "kind": "tool",
        "toolName": "web_search",
        "title": "使用工具",
        "status": "in_progress",
        "progressText": "正在搜索…",
        "content": "",
        "artifactIds": ["art_123", "art_456"],
        "timestamp": 1704000001500
      }
    ],
    "artifacts": [] // 该会话关联的历史产物数组
  }
  ```

### `message:start`
助手开始回复时发送。
- **Payload**:
  ```json
  {
    "id": "msg_001", // 消息唯一 ID
    "role": "assistant",
    "content": "" // 初始内容，通常为空
  }
  ```

### `message:chunk`
助手回复内容的流式增量。
- **Payload**:
  ```json
  {
    "id": "msg_001",
    "chunk": "你好" // 本次增量的文本
  }
  ```

### `tool:message:start`
工具过程消息开始（每次工具调用对应一条 `kind: 'tool'` 的 assistant 消息）。
- **Payload**:
  ```json
  {
    "id": "tool_001",
    "role": "assistant",
    "kind": "tool",
    "status": "in_progress",
    "toolName": "web_search",
    "title": "使用工具",
    "content": "",
    "progressText": "正在搜索…",
    "parentMessageId": "msg_001",
    "timestamp": 1704000001500
  }
  ```

### `tool:message:update`
工具过程消息更新（更新进度文案/状态/摘要内容等）。
- **Payload**:
  ```json
  {
    "id": "tool_001",
    "patch": {
      "progressText": "已找到 10 条结果",
      "content": "正在整理结果…"
    },
    "timestamp": 1704000002000
  }
  ```

### `tool:message:complete`
工具过程消息结束（成功/失败）。
- **Payload**:
  ```json
  {
    "id": "tool_001",
    "status": "completed",
    "timestamp": 1704000003000
  }
  ```

### `progress`
长耗时任务的进度反馈。
- **Payload**:
  ```json
  {
    "status": "generating_pptx",
    "progress": 45, // 0-100
    "message": "正在渲染第 3 张幻灯片...",
    "artifactId": "art_123" // (可选) 关联的产物 ID
  }
  ```

### `tool:artifact`
工具生成了新的产物（如文件、代码、PPT 等）。

**重要约定**：
- `tool:artifact` **可以在一次工具调用过程中多次发送**
- 每次发送的 `messageId` 必须指向对应的 `tool:message:start` 的 `id`（即 tool message id）
- 前端会把 `artifact.id` 追加到该 tool message 的 `artifactIds` 中（展示为多条 artifact 线索）
- **Payload**:
  ```json
  {
    "messageId": "tool_001",
    "artifact": {
      "id": "art_123",
      "type": "pptx", // 'plan' | 'dsl' | 'pptx' | 'search_result' | 'web_page'
      "content": { /* 产物具体内容 */ },
      "timestamp": 1704000000000
    },
    "showInCanvas": true // 是否立即在右侧画布区域显示
  }
  ```

### `completion`
整个回复流程结束。
- **Payload**:
  ```json
  {
    "success": true,
    "result": {}, // (可选) 最终结果
    "finalArtifactId": "art_123" // (可选) 最终生成的产物 ID
  }
  ```

---

## 4. 典型通信流程示例

1.  **连接**: Client 连接 Server。
2.  **握手**: Client 发送 `chat:init` -> Server 发送 `chat:init:response`。
3.  **提问**: Client 发送 `chat:send` { "message": "帮我写一个 PPT" }。
4.  **开始回复**: Server 发送 `message:start`。
5.  **内容流**: Server 发送多次 `message:chunk`。
6.  **工具开始**: Server 发送 `tool:message:start`（生成一条 tool message）。
7.  **产物线索（可多次）**: Server 多次发送 `tool:artifact`，`messageId` 指向 tool message。
8.  **工具结束**: Server 发送 `tool:message:complete`。
9.  **结束**: Server 发送 `completion`。

## 5. 核心数据结构说明

### Artifact (产物)
```typescript
{
  id: string;
  type: 'plan' | 'dsl' | 'pptx' | 'search_result' | 'web_page' | 'requirement_analysis';
  content: any; // 根据 type 不同，内容结构也不同
  version?: string;
  timestamp: number;
}
```

### Tool Message (过程型消息)
```typescript
{
  id: string;
  role: 'assistant';
  kind: 'tool';
  status: 'in_progress' | 'completed' | 'error';
  toolName: string;
  title?: string;
  content: string;
  progressText?: string;
  parentMessageId?: string;
  artifactIds?: string[];
  timestamp: number;
}
```
