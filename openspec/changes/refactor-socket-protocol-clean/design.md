# Design: Socket 协议重构技术设计

## Context
前端已按照 `SOCKET_INTEGRATION.md` 定义的新协议进行开发，该协议采用"过程型消息"思路，每个工具调用对应一条独立的 `kind: 'tool'` 消息。后端当前使用的是旧协议，包含 `thought:update`、`tool:log` 等事件，需要完全重构以消除历史包袱。

约束条件：
- 必须保持与前端协议 100% 一致
- 不能破坏现有的 Redis 存储机制
- 需要支持多次 `tool:artifact` 绑定到同一个 tool message
- 当前功能范围仅需实现到 tasks 生成阶段

## Goals / Non-Goals

### Goals
- 完全符合 `SOCKET_INTEGRATION.md` 定义的协议规范
- 移除所有旧协议事件和相关代码
- 重构消息流程，采用 tool message 模式
- 确保会话历史和产物正确存储和恢复
- 实现到 tasks 生成阶段（需求分析 + 规划）

### Non-Goals
- 不实现 PPT 生成功能（超出当前范围）
- 不修改前端代码（前端已按新协议开发）
- 不改变 Redis 底层存储技术栈
- 不优化性能（仅重构协议）

## Decisions

### 1. 消息类型设计
**决策**: 使用 `kind` 字段区分消息类型
- `kind: 'chat'` - 普通对话消息
- `kind: 'tool'` - 工具过程消息

**理由**: 
- 前端协议明确要求此结构
- 便于前端区分渲染逻辑
- 符合"过程型消息"理念

### 2. Tool Message 生命周期
**决策**: 采用三阶段事件模型
1. `tool:message:start` - 创建 tool message
2. `tool:message:update` - 更新进度/状态/内容
3. `tool:message:complete` - 标记完成/失败

**理由**:
- 清晰的状态转换
- 支持流式更新
- 前端可以实时渲染进度

### 3. Artifact 绑定机制
**决策**: 通过 `tool:artifact` 事件的 `messageId` 字段绑定到 tool message
- 一个 tool message 可以关联多个 artifact
- 每次发送 `tool:artifact` 时，前端将 `artifact.id` 追加到对应 tool message 的 `artifactIds` 数组

**理由**:
- 支持一次工具调用产生多个产物（如搜索结果 + 分析报告）
- 前端可以展示多条 artifact 线索
- 符合协议约定

### 4. 会话历史存储
**决策**: 直接存储符合协议的消息对象
```typescript
// User message
{
  role: 'user',
  content: string,
  timestamp: number
}

// Assistant chat message
{
  id: string,
  role: 'assistant',
  kind: 'chat',
  content: string,
  timestamp: number
}

// Assistant tool message
{
  id: string,
  role: 'assistant',
  kind: 'tool',
  status: 'in_progress' | 'completed' | 'error',
  toolName: string,
  title?: string,
  content: string,
  progressText?: string,
  parentMessageId?: string,
  artifactIds?: string[],
  timestamp: number
}
```

**理由**:
- `chat:init:response` 可以直接返回存储的消息
- 无需转换逻辑
- 前端可以直接使用

### 5. 移除旧事件
**决策**: 完全移除以下事件和相关代码
- `thought:update` - 由 tool message 替代
- `tool:log` - 由 tool message 替代
- `plan:start` - 由 tool message + message:chunk 替代
- `artifact:update` - 由 `tool:artifact` 替代

**理由**:
- 消除历史包袱
- 简化代码逻辑
- 避免前端混淆

### 6. 实现范围
**决策**: 当前仅实现需求分析和规划阶段
- 需求分析工具调用（生成 requirement_analysis artifact）
- 规划工具调用（生成 plan artifact）
- 不实现 PPT 生成

**理由**:
- 用户明确要求"当前功能只做到 tasks 里即可"
- 降低初始实现复杂度
- 后续可以基于新协议扩展

## Alternatives Considered

### 备选方案 1: 保留旧事件作为兼容层
**拒绝理由**: 用户明确要求"没有历史包袱，完全按照新的协议开发"

### 备选方案 2: 渐进式迁移
**拒绝理由**: 会导致新旧协议混用，增加维护成本

## Risks / Trade-offs

### 风险 1: Breaking Changes
**影响**: 所有依赖旧协议的客户端将无法工作
**缓解**: 前端已按新协议开发，无需担心

### 风险 2: 数据迁移
**影响**: 现有会话历史可能无法正确加载
**缓解**: 
- 可以通过 Redis TTL 自然过期旧数据
- 或提供迁移脚本（如需要）

### 权衡: 实现范围
**权衡**: 仅实现到 tasks 阶段，PPT 生成功能暂不实现
**理由**: 符合用户当前需求，降低初始复杂度

## Migration Plan

### 阶段 1: 重构 Socket Gateway
1. 移除旧事件发射方法
2. 新增 tool message 相关方法
3. 更新 `chat:init` 处理逻辑

### 阶段 2: 重构 Chat Service
1. 修改消息存储结构
2. 重构消息处理流程
3. 使用新的事件发射方法

### 阶段 3: 调整 Agent Service
1. 修改回调接口
2. 确保输出符合新协议

### 阶段 4: 测试验证
1. 测试 `chat:init` 返回正确的消息结构
2. 测试需求分析流程
3. 测试规划流程
4. 测试 artifact 绑定

### Rollback
如果出现问题，可以：
1. 回滚代码到重构前版本
2. Redis 数据通过 TTL 自然过期

## Open Questions
1. ✅ 是否需要迁移现有会话数据？ - 答：不需要，通过 TTL 自然过期
2. ✅ PPT 生成功能何时实现？ - 答：当前不实现，仅到 tasks 阶段
3. ✅ 是否需要保留任何旧事件？ - 答：不需要，完全移除
