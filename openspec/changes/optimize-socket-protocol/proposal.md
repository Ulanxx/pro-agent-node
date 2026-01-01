---
description: 优化 Socket.io 通信协议以符合前端对接文档
---

# Change: Optimize Socket.io Communication Protocol

## Why
当前后端的 Socket.io 通信协议与前端期望的文档 `@/Users/ulanxx/ulanxx_workspace/pro-agent/src/modules/socket/SOCKET_INTEGRATION.md` 存在不一致，导致前端无法正确解析和展示部分消息。

## What Changes
- **统一会话初始化响应**: 将 `chat:init` 的响应事件名改为 `chat:init:response`。
- **引入流式消息事件**: 新增 `message:start` 和 `message:chunk` 事件用于推送助手回复。
- **规范产物发送**: 所有的任务计划、PPT、网页等结构化内容统一通过 `tool:artifact` 发送。
- **结构对齐**: 更新 `Thought`、`ToolLog` 等数据结构，确保字段与文档一致。

## Impact
- Affected specs: `socket-communication`
- Affected code: `socket.gateway.ts`, `chat.service.ts`
