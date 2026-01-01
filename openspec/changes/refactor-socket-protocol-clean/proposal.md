# Change: 重构 Socket 通信协议以符合无历史包袱版本

## Why
当前系统的 Socket 通信协议存在历史遗留问题，使用了 `thought:update`、`tool:log`、`plan:start` 等事件，与前端约定的新协议不一致。前端已按照 `SOCKET_INTEGRATION.md` 中定义的"过程型消息（tool message）"思路进行对接，后端需要完全重构以匹配该协议，消除所有历史包袱。

新协议的核心理念：
- 每次工具调用对应一条独立的 assistant 消息（`kind: 'tool'`）
- 工具产物通过 `tool:artifact` 事件可多次绑定到该 tool message
- 不再使用 `thought:update`、`tool:log` 等旧事件
- 前端不做任何历史归并，后端直接输出符合协议的消息结构

## What Changes
- **BREAKING**: 移除所有旧协议事件（`thought:update`、`tool:log`、`plan:start`、`artifact:update`）
- **BREAKING**: 重构消息流程，采用 `tool:message:start` -> `tool:message:update` -> `tool:message:complete` 模式
- **BREAKING**: 重构 ChatService 和 AgentService，使其输出符合新协议的消息结构
- **BREAKING**: 修改会话历史存储结构，直接存储符合协议的消息对象
- 新增 `tool:message:start`、`tool:message:update`、`tool:message:complete` 事件支持
- 修改 `tool:artifact` 事件，确保 `messageId` 指向 tool message
- 重构进度反馈机制，通过 `progress` 事件和 tool message 更新实现
- 更新 `chat:init:response` 返回的消息结构，包含 `kind` 字段区分消息类型

## Impact
- **Affected specs**: `socket-communication`、`agent-interaction`
- **Affected code**: 
  - `src/modules/socket/socket.gateway.ts` - 完全重构事件发射方法
  - `src/modules/agent/chat.service.ts` - 重构消息处理流程
  - `src/modules/agent/agent.service.ts` - 调整回调接口
  - `src/modules/agent/artifact.service.ts` - 可能需要调整
  - 所有使用旧协议的代码
- **Migration**: 前端已按新协议开发，此变更是后端适配前端协议
- **Breaking Changes**: 
  - 移除 `thought:update`、`tool:log`、`plan:start`、`artifact:update` 事件
  - 修改消息历史结构
  - 修改所有 Socket 事件的 payload 结构
