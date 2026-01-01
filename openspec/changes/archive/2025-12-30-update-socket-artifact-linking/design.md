## Context
前端 AnyGen Frontend 需要通过 `artifactId` 实现 AI 思考过程与右侧产物卡片的联动。当用户点击某个带有 `artifactId` 的思考步骤或进度条时，前端能自动定位到右侧对应的产物。

## Goals
- 实现后端对 `artifactId` 的支持。
- 规范化 Socket 事件结构。
- 确保产物 ID 在生成会话中保持稳定。

## Decisions

### 1. 事件结构优化
- **Progress 事件**: 在原有基础上增加 `artifactId?: string`。
- **Thought Update 事件**: 引入 `thought:update` 事件，支持嵌套子步骤和 `artifactId` 绑定。

### 2. ID 稳定性
产物 ID 必须由后端在生成之初就确定，并贯穿整个 `thought` 和 `artifact:update` 过程。

## Risks / Trade-offs
- 如果 `artifactId` 指向了一个尚未发送的产物，前端可能无法立即定位。**缓解措施**: 建议后端在推送进度或思考步骤前，或几乎同时推送产物占位。
