## ADDED Requirements

### Requirement: API 状态管理
前端应用 MUST 使用 TanStack Query 管理服务端状态。

#### Scenario: 获取应用列表
- **WHEN** 首页组件挂载
- **THEN** 使用 `useQuery` 获取应用列表
- **AND** 自动缓存查询结果
- **AND** 支持后台自动刷新

#### Scenario: 创建应用
- **WHEN** 用户提交创建表单
- **THEN** 使用 `useMutation` 调用创建 API
- **AND** 成功后自动失效应用列表缓存
- **AND** 触发列表重新获取

#### Scenario: 获取应用详情
- **WHEN** 详情页组件挂载
- **THEN** 使用 `useQuery` 获取应用详情
- **AND** 根据应用 ID 作为查询键
- **AND** 自动缓存查询结果

#### Scenario: 发送消息
- **WHEN** 用户发送聊天消息
- **THEN** 使用 `useMutation` 调用消息 API
- **AND** 乐观更新本地消息列表
- **AND** 失败时回滚更新

### Requirement: WebSocket 状态管理
前端应用 MUST 使用自定义 Hook 管理 WebSocket 连接和状态。

#### Scenario: 建立 WebSocket 连接
- **WHEN** 详情页组件挂载
- **THEN** 使用 `useWebSocket` Hook 建立连接
- **AND** 订阅当前应用的更新事件
- **AND** 组件卸载时自动断开连接

#### Scenario: 接收应用状态更新
- **WHEN** 收到 `app:status:update` 事件
- **THEN** 更新本地应用状态
- **AND** 失效 TanStack Query 缓存
- **AND** 触发 UI 重新渲染

#### Scenario: 接收进度更新
- **WHEN** 收到 `app:progress:update` 事件
- **THEN** 更新进度条显示
- **AND** 显示当前步骤信息

#### Scenario: 接收 Artifact 创建事件
- **WHEN** 收到 `artifact:created` 事件
- **THEN** 添加新 Artifact 到列表
- **AND** 显示新建通知

#### Scenario: 接收消息创建事件
- **WHEN** 收到 `message:created` 事件
- **THEN** 添加新消息到聊天列表
- **AND** 自动滚动到最新消息

#### Scenario: WebSocket 重连
- **WHEN** WebSocket 连接断开
- **THEN** 自动尝试重连
- **AND** 显示连接状态提示
- **AND** 重连成功后重新订阅事件

### Requirement: 本地 UI 状态
前端应用 MUST 使用 React Hooks 管理本地 UI 状态。

#### Scenario: 输入框状态
- **WHEN** 用户在输入框中输入
- **THEN** 使用 `useState` 管理输入值
- **AND** 实时更新 UI

#### Scenario: 模态框状态
- **WHEN** 用户打开模态框
- **THEN** 使用 `useState` 管理显示状态
- **AND** 支持打开和关闭操作

#### Scenario: 标签页状态
- **WHEN** 用户切换标签页
- **THEN** 使用 `useState` 管理当前标签
- **AND** 根据标签过滤显示内容

### Requirement: 缓存策略
前端应用 MUST 实现合理的缓存策略，优化性能。

#### Scenario: 应用列表缓存
- **WHEN** 获取应用列表
- **THEN** 缓存时间设置为 5 分钟
- **AND** 支持手动刷新
- **AND** 后台自动重新验证

#### Scenario: 应用详情缓存
- **WHEN** 获取应用详情
- **THEN** 缓存时间设置为 1 分钟
- **AND** WebSocket 更新时自动失效
- **AND** 支持手动刷新

#### Scenario: Artifact 列表缓存
- **WHEN** 获取 Artifact 列表
- **THEN** 缓存时间设置为 30 秒
- **AND** 新 Artifact 创建时自动失效
- **AND** 支持手动刷新

### Requirement: 错误状态管理
前端应用 MUST 统一管理和显示错误状态。

#### Scenario: API 错误处理
- **WHEN** API 请求失败
- **THEN** TanStack Query 自动捕获错误
- **AND** 组件中使用 `error` 状态显示错误
- **AND** 提供重试功能

#### Scenario: WebSocket 错误处理
- **WHEN** WebSocket 连接失败
- **THEN** 显示连接错误提示
- **AND** 自动尝试重连
- **AND** 记录错误日志

### Requirement: 加载状态管理
前端应用 MUST 统一管理和显示加载状态。

#### Scenario: 查询加载状态
- **WHEN** 执行查询操作
- **THEN** TanStack Query 提供 `isLoading` 状态
- **AND** 组件显示加载指示器
- **AND** 禁用相关操作

#### Scenario: 变更加载状态
- **WHEN** 执行变更操作
- **THEN** TanStack Query 提供 `isPending` 状态
- **AND** 组件显示提交中状态
- **AND** 禁用提交按钮
