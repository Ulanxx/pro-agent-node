# 实施任务清单

## 1. Socket Gateway 重构
- [x] 1.1 移除旧事件发射方法（`emitThoughtUpdate`、`emitToolLog`、`emitPlanStart`）
- [x] 1.2 新增 `emitToolMessageStart` 方法
- [x] 1.3 新增 `emitToolMessageUpdate` 方法
- [x] 1.4 新增 `emitToolMessageComplete` 方法
- [x] 1.5 更新 `emitToolArtifact` 方法确保符合协议
- [x] 1.6 移除 `emitPlanUpdate` 方法（plan 通过 artifact 传递）
- [x] 1.7 更新 `handleChatInit` 方法，确保返回符合协议的消息结构

## 2. 消息类型定义
- [x] 2.1 在 `src/shared/types/` 创建消息类型定义文件
- [x] 2.2 定义 `UserMessage` 接口
- [x] 2.3 定义 `AssistantChatMessage` 接口
- [x] 2.4 定义 `AssistantToolMessage` 接口
- [x] 2.5 定义 `ToolMessagePatch` 接口
- [x] 2.6 定义消息联合类型 `Message`

## 3. Chat Service 重构
- [x] 3.1 修改 `saveMessage` 方法，支持新的消息结构
- [x] 3.2 新增 `saveToolMessage` 方法
- [x] 3.3 新增 `updateToolMessage` 方法（更新 artifactIds 等字段）
- [x] 3.4 移除 `saveThought` 方法
- [x] 3.5 重构 `handleMessage` 方法主流程
- [x] 3.6 实现需求分析阶段的 tool message 流程
- [x] 3.7 实现规划阶段的 tool message 流程
- [x] 3.8 确保 `getSessionHistory` 返回符合协议的消息结构

## 4. Agent Service 适配
- [x] 4.1 修改 `analyzeTopic` 方法的回调接口（无需修改，回调接口已兼容）
- [x] 4.2 修改 `planDocument` 方法的回调接口（无需修改，回调接口已兼容）
- [x] 4.3 确保回调提供足够的信息用于构建 tool message（已在 Chat Service 中处理）

## 5. 需求分析流程实现
- [x] 5.1 创建需求分析 tool message（`tool:message:start`）
- [x] 5.2 在分析过程中更新进度（`tool:message:update`）
- [x] 5.3 生成 requirement_analysis artifact 并绑定（`tool:artifact`）
- [x] 5.4 完成 tool message（`tool:message:complete`）
- [x] 5.5 保存 tool message 到会话历史

## 6. 规划流程实现
- [x] 6.1 创建规划 tool message（`tool:message:start`）
- [x] 6.2 在规划过程中更新进度（`tool:message:update`）
- [x] 6.3 生成 plan artifact 并绑定（`tool:artifact`）
- [x] 6.4 完成 tool message（`tool:message:complete`）
- [x] 6.5 保存 tool message 到会话历史

## 7. 会话历史存储
- [x] 7.1 确保 user 消息按新结构存储
- [x] 7.2 确保 assistant chat 消息按新结构存储（包含 `kind: 'chat'`）
- [x] 7.3 确保 assistant tool 消息按新结构存储（包含完整字段）
- [x] 7.4 实现 tool message 的 `artifactIds` 数组更新逻辑

## 8. 清理旧代码
- [x] 8.1 移除所有 `thought:update` 相关代码
- [x] 8.2 移除所有 `tool:log` 相关代码
- [x] 8.3 移除所有 `plan:start` 相关代码
- [x] 8.4 移除所有 `artifact:update` 相关代码（已在 Chat Service 中移除）
- [x] 8.5 清理未使用的类型定义和接口

## 9. 测试验证
- [ ] 9.1 测试 `chat:init` 新会话场景
- [ ] 9.2 测试 `chat:init` 恢复会话场景
- [ ] 9.3 测试需求分析完整流程
- [ ] 9.4 测试规划完整流程
- [ ] 9.5 测试 artifact 绑定到 tool message
- [ ] 9.6 测试多个 artifact 绑定到同一 tool message
- [ ] 9.7 测试消息历史正确存储和恢复
- [ ] 9.8 验证所有事件 payload 符合协议文档

## 10. 文档更新
- [ ] 10.1 更新 README.md 中的协议说明
- [ ] 10.2 确保 SOCKET_INTEGRATION.md 与实现一致
- [ ] 10.3 添加代码注释说明新的消息流程
