# Design: Socket.io Protocol Optimization

## Architecture Overview
后端采用 NestJS WebSocket Gateway 配合 `socket.io`。`SocketGateway` 负责维护连接和分发事件，`ChatService` 负责具体的业务逻辑和触发推送。

## Event Mapping Table
| 代码当前事件 | 文档要求事件 | 动作 |
| :--- | :--- | :--- |
| (无) | `message:start` | 新增，表示助手开始响应 |
| (无) | `message:chunk` | 新增，用于流式文本 |
| `thought:update` | `thought:update` | 保持并更新结构 |
| `tool:log` | `tool:log` | 保持并更新结构 |
| `plan:start` | `tool:artifact` (type: 'plan') | 迁移，Plan 被视为一种 Artifact |
| `plan:update` | `tool:artifact` (type: 'plan') | 迁移 |
| `chat:init` 返回值 | `chat:init:response` | 修改响应方式 |

## Implementation Details
1. **Stream Management**: `ChatService` 在处理 AI 响应时，需要分段调用 `gateway.emitMessageChunk`。
2. **Compatibility**: 暂时保留 `plan:*` 事件的发射逻辑，但标记为废弃，优先发送新事件。
