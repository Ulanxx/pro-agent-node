# Change: Update Socket Artifact Linking

## Why
目前后端推送的 Socket 事件缺乏 `artifactId` 字段，导致前端无法将 AI 的思考过程（Thinking）或进度条（Progress）与右侧生成的产物卡片（Artifact）进行点击跳转联动。

## What Changes
- **MODIFIED**: `progress` 事件，增加可选字段 `artifactId`。
- **ADDED**: `thought:update` 事件，用于推送带 `artifactId` 的思考步骤。
- **MODIFIED**: `artifact:update` 事件，确保 `id` 稳定性。
- **ADDED**: 思考步骤与产物的联动逻辑。

## Impact
- **Affected specs**: `socket-communication`
- **Affected code**: `src/modules/socket/socket.gateway.ts`, `src/modules/agent/chat.service.ts`
