# socket-communication Spec Delta

## ADDED Requirements

### Requirement: Application Room Subscription
系统 MUST 支持客户端订阅应用级别的 Socket 事件。

#### Scenario: 订阅应用更新
- **WHEN** 客户端发送 app:subscribe 事件，包含 applicationId
- **THEN** 将客户端加入 application_${applicationId} room
- **AND** 返回订阅成功确认
- **AND** 客户端开始接收该应用的实时事件

#### Scenario: 订阅不存在的应用
- **WHEN** applicationId 不存在
- **THEN** 返回错误消息
- **AND** 不创建 room

### Requirement: Application Status Updates
系统 MUST 在应用状态变更时推送 Socket 事件。

#### Scenario: 应用开始处理
- **WHEN** 应用状态从 'created' 变为 'processing'
- **THEN** 向 application_${applicationId} room 推送 app:status:update 事件
- **AND** 事件包含：
  - applicationId: UUID
  - oldStatus: 'created'
  - newStatus: 'processing'
  - timestamp: Unix timestamp

#### Scenario: 应用完成
- **WHEN** 应用状态变为 'completed'
- **THEN** 推送 app:status:update 事件
- **AND** 包含 newStatus='completed' 和 finalArtifactId

#### Scenario: 应用失败
- **WHEN** 应用状态变为 'failed'
- **THEN** 推送 app:status:update 事件
- **AND** 包含错误信息

### Requirement: Enhanced Progress Updates
系统 MUST 推送更详细的进度信息。

#### Scenario: 阶段级进度更新
- **WHEN** PPT 生成进入新阶段（如课程配置生成）
- **THEN** 推送 app:progress:update 事件
- **AND** 事件包含：
  - applicationId: UUID
  - progress: 0-100
  - currentStage: 'course_config' | 'video_outline' | 'slide_scripts' | 'presentation_theme' | 'slide_generation'
  - message: "正在生成课程配置..."
  - timestamp: Unix timestamp

#### Scenario: 页面级进度更新
- **WHEN** 逐页生成 PPT 时
- **THEN** 每生成一页推送一次事件
- **AND** 事件包含：
  - progress: 计算百分比
  - currentPage: 当前页码
  - totalPages: 总页数
  - message: "正在生成第 3/10 页..."

### Requirement: Artifact Creation Notification
系统 MUST 在 artifact 创建时推送通知。

#### Scenario: 新 artifact 创建
- **WHEN** 新 artifact 保存到 OSS 和 MySQL
- **THEN** 推送 artifact:created 事件
- **AND** 事件包含：
  - artifactId: UUID
  - applicationId: UUID
  - type: artifact 类型
  - title: artifact 标题
  - ossUrl: 访问 URL（如果可公开访问）
  - timestamp: 创建时间

#### Scenario: PPTX 生成完成通知
- **WHEN** 最终 PPTX 文件生成完成
- **THEN** 推送 artifact:created 事件
- **AND** type='pptx'
- **AND** 包含下载链接或指引

### Requirement: Error Notifications
系统 MUST 推送实时的错误通知。

#### Scenario: 任务执行失败
- **WHEN** 任何任务执行失败
- **THEN** 推送 error 事件
- **AND** 事件包含：
  - applicationId: UUID
  - taskId: UUID（如果适用）
  - errorCode: 错误代码
  - errorMessage: 用户友好的错误描述
  - timestamp: 发生时间

#### Scenario: 文件上传失败
- **WHEN** 文件上传到 OSS 失败
- **THEN** 推送 error 事件
- **AND** errorMessage 包含失败原因（如网络错误、文件过大）

#### Scenario: LLM 调用失败
- **WHEN** LLM API 调用失败（如超时、配额不足）
- **THEN** 推送 error 事件
- **AND** errorMessage 说明问题
- **AND** 建议用户重试或稍后尝试

## MODIFIED Requirements

### Requirement: Session Initialization
系统 MUST 支持通过 applicationId 初始化会话，并兼容旧的 sessionId。

#### Scenario: 通过 applicationId 加载会话
- **WHEN** 客户端发送 chat:init 事件，包含 applicationId（替代 sessionId）
- **THEN** 从 MySQL 查询应用的完整数据
- **AND** 加载消息历史（最近 100 条）
- **AND** 加载 artifact 列表
- **AND** 加载当前进度
- **AND** 将客户端加入 session_${applicationId} room
- **AND** 返回 chat:init:response 事件

#### Scenario: 兼容旧的 sessionId
- **WHEN** 客户端仍使用 sessionId（向后兼容）
- **THEN** 将 sessionId 作为 applicationId 处理
- **AND** 提示客户端迁移到新的 applicationId 参数

### Requirement: Room-based Broadcasting
系统 MUST 同时向 session room 和 application room 广播事件以确保兼容性。

#### Scenario: 应用级事件广播
- **WHEN** 发送应用相关事件
- **THEN** 同时向两个 room 广播：
  - session_${applicationId}（兼容旧版）
  - application_${applicationId}（新版）
- **AND** 确保所有订阅的客户端都能收到

#### Scenario: 客户端加入应用 room
- **WHEN** 客户端发送 chat:init 或 app:subscribe
- **THEN** 将客户端同时加入两个 room
- **AND** 确保事件接收的可靠性

### Requirement: Message Type Distinction
系统 MUST 在所有消息事件中包含 applicationId 字段。

#### Scenario: 消息包含 applicationId
- **WHEN** 推送任何消息事件（message:start、message:chunk、tool:start 等）
- **THEN** 事件 payload 必须包含 applicationId
- **AND** 前端可以根据 applicationId 过滤和显示消息

#### Scenario: Tool 消息关联应用
- **WHEN** 发送 tool:start、tool:update、tool:complete 事件
- **THEN** 包含 applicationId 和 taskId
- **AND** 前端可以追踪任务执行的完整过程

### Requirement: Tool Artifact Binding
系统 MUST 在 artifact 事件中包含数据库主键 artifactId 和 applicationId。

#### Scenario: Artifact 事件包含完整信息
- **WHEN** 推送 tool:artifact 事件
- **THEN** 事件必须包含：
  - artifactId: UUID（数据库主键）
  - applicationId: UUID
  - type: artifact 类型
  - messageId: 关联的消息 ID
  - showInCanvas: 是否在画布显示
  - artifact: artifact 对象（包含内容或引用）

#### Scenario: 大 artifact 处理
- **WHEN** artifact 内容过大（> 1MB）
- **THEN** artifact 对象只包含摘要信息
- **AND** 前端通过 artifactId 调用 REST API 获取完整内容
- **AND** 或通过签名 URL 从 OSS 下载

### Requirement: Progress Feedback
系统 MUST 在进度事件中包含 applicationId 并持久化到数据库。

#### Scenario: 进度事件包含应用上下文
- **WHEN** 推送 progress 事件
- **THEN** 包含 applicationId
- **AND** 包含当前阶段信息
- **AND** 包含预计剩余时间（如果可计算）

#### Scenario: 进度持久化
- **WHEN** 推送进度事件
- **THEN** 同时更新 MySQL 中的进度状态
- **AND** 便于用户刷新页面后恢复

## REMOVED Requirements

无移除的需求，仅增强现有功能。
