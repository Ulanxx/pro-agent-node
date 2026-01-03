# application-management Spec Delta

## ADDED Requirements

### Requirement: Application Creation
系统 MUST 支持通过 REST API 创建应用会话。

#### Scenario: 创建新的 PPT 生成应用
- **WHEN** 用户通过 POST /api/applications 提交创建请求
- **THEN** 系统生成唯一的应用 ID（UUID）
- **AND** 创建应用记录，包含 userId、inputType、inputContent、status（初始为 'created'）
- **AND** 在 MySQL 中持久化应用数据
- **AND** 在 Redis 中缓存应用状态
- **AND** 返回应用 ID 和初始状态

#### Scenario: 创建应用时输入验证
- **WHEN** 请求缺少必需字段（userId、inputType）
- **THEN** 返回 400 错误
- **AND** 说明缺少的字段

#### Scenario: 创建应用时输入类型不合法
- **WHEN** inputType 不是 'text'、'file' 或 'url' 之一
- **THEN** 返回 400 错误
- **AND** 说明支持的输入类型

### Requirement: Application Retrieval
系统 MUST 支持查询单个应用的完整信息。

#### Scenario: 查询应用详情
- **WHEN** 用户通过 GET /api/applications/:id 查询应用
- **AND** 应用存在
- **THEN** 返回应用的完整信息，包括：
  - 基础信息：id、title、status、inputType、createdAt、updatedAt
  - 关联的消息列表（最新 100 条）
  - 关联的 artifact 列表（按创建时间倒序）
  - 任务树结构（包含父子关系）
- **AND** 返回的状态是当前最新状态

#### Scenario: 查询不存在的应用
- **WHEN** 应用 ID 不存在
- **THEN** 返回 404 错误

#### Scenario: 查询他人应用（权限控制）
- **WHEN** userId 与当前用户不匹配
- **THEN** 返回 403 权限错误

### Requirement: Application List Query
系统 MUST 支持分页查询应用列表。

#### Scenario: 查询用户的所有应用
- **WHEN** 通过 GET /api/applications?userId=xxx 查询
- **THEN** 返回该用户的应用列表
- **AND** 按创建时间倒序排列
- **AND** 支持分页（page、pageSize 参数）
- **AND** 返回总数（total）

#### Scenario: 按状态筛选应用
- **WHEN** 添加 status 参数（如 ?status=completed）
- **THEN** 只返回该状态的应用

#### Scenario: 应用列表分页
- **WHEN** 指定 page=2&pageSize=20
- **THEN** 返回第 2 页的 20 条记录
- **AND** 包含 total 字段表示总数

### Requirement: Application Status Update
系统 MUST 支持更新应用状态。

#### Scenario: 更新应用为处理中
- **WHEN** PPT 生成开始时
- **THEN** 将状态从 'created' 更新为 'processing'
- **AND** 更新 updatedAt 时间戳
- **AND** 通过 Socket 推送 app:status:update 事件

#### Scenario: 更新应用为已完成
- **WHEN** PPT 生成成功完成
- **THEN** 将状态更新为 'completed'
- **AND** 保存最终 artifact 关联
- **AND** 推送 Socket 事件

#### Scenario: 更新应用为失败
- **WHEN** 生成过程发生错误
- **THEN** 将状态更新为 'failed'
- **AND** 记录错误信息到 metadata
- **AND** 推送 Socket 事件

### Requirement: File Upload Handling
系统 MUST 支持上传文件并关联到应用。

#### Scenario: 上传 PDF 文件
- **WHEN** 用户通过 POST /api/applications/:id/upload-file 上传 PDF
- **THEN** 验证文件类型（application/pdf）
- **AND** 验证文件大小（不超过 10MB）
- **AND** 将文件上传到 OSS（路径：uploads/YYYY/MM/DD/fileId.pdf）
- **AND** 保存文件元数据到 MySQL
- **AND** 关联到应用记录
- **AND** 返回 OSS 访问 URL

#### Scenario: 上传 Word 文档
- **WHEN** 用户上传 Word 文档（.doc/.docx）
- **THEN** 处理流程同 PDF
- **AND** 支持的 MIME 类型包括 application/msword 和 application/vnd.openxmlformats-officedocument.wordprocessingml.document

#### Scenario: 文件类型不支持
- **WHEN** 上传不支持的文件类型（如 .exe）
- **THEN** 返回 400 错误
- **AND** 说明支持的文件类型

#### Scenario: 文件超过大小限制
- **WHEN** 上传的文件超过 10MB
- **THEN** 返回 413 Payload Too Large 错误

### Requirement: URL Parsing
系统 MUST 支持解析网页 URL 并提取内容。

#### Scenario: 解析有效的网页 URL
- **WHEN** 用户通过 POST /api/applications/:id/parse-url 提交 URL
- **THEN** 验证 URL 格式
- **AND** 发起 HTTP 请求获取网页内容
- **AND** 提取页面标题和正文
- **AND** 保存解析结果到 MySQL
- **AND** 关联到应用记录
- **AND** 返回解析后的内容

#### Scenario: URL 格式无效
- **WHEN** 提交的 URL 不是有效的 HTTP/HTTPS URL
- **THEN** 返回 400 错误
- **AND** 说明 URL 格式问题

#### Scenario: 网页无法访问
- **WHEN** 目标网页返回 404 或 500 错误
- **THEN** 返回 502 Bad Gateway 错误
- **AND** 记录错误日志

### Requirement: Text Input Handling
系统 MUST 支持接收文本输入作为 PPT 生成素材。

#### Scenario: 提交文本输入
- **WHEN** 用户通过 POST /api/applications/:id/input-text 提交文本
- **THEN** 验证文本长度（10-10000 字符）
- **AND** 保存到应用的 inputContent 字段
- **AND** 创建一条用户消息记录
- **AND** 返回消息 ID

#### Scenario: 文本过短
- **WHEN** 提交的文本少于 10 个字符
- **THEN** 返回 400 错误
- **AND** 说明文本长度要求

#### Scenario: 文本过长
- **WHEN** 提交的文本超过 10000 个字符
- **THEN** 返回 413 错误
- **AND** 说明最大长度限制

### Requirement: Start Generation Workflow
系统 MUST 支持启动 PPT 生成工作流。

#### Scenario: 启动自主规划模式
- **WHEN** 用户通过 POST /api/applications/:id/start 启动
- **AND** 指定 mode='autonomous'
- **THEN** 更新应用状态为 'processing'
- **AND** 创建初始任务记录到 tasks 表
- **AND** 调用 AutonomousGraphService 开始执行
- **AND** 返回 sessionId 用于 Socket 连接

#### Scenario: 启动 5 阶段模式
- **WHEN** 指定 mode='5-stage'
- **THEN** 更新应用状态为 'processing'
- **AND** 调用 Chat5StageService 开始执行
- **AND** 返回 sessionId

#### Scenario: 应用状态不允许启动
- **WHEN** 应用当前状态不是 'created'
- **THEN** 返回 409 Conflict 错误
- **AND** 说明应用正在处理或已完成

### Requirement: Application Deletion
系统 MUST 支持软删除应用。

#### Scenario: 删除应用
- **WHEN** 用户通过 DELETE /api/applications/:id 删除应用
- **AND** 应用存在且属于该用户
- **THEN** 标记为已删除（软删除）
- **AND** 同时级联删除关联的消息、artifacts、tasks
- **AND** 清除 Redis 缓存
- **AND** 返回 204 No Content

#### Scenario: 删除不存在的应用
- **WHEN** 应用 ID 不存在
- **THEN** 返回 404 错误

### Requirement: Message History Query
系统 MUST 支持查询应用的消息历史。

#### Scenario: 查询完整消息历史
- **WHEN** 通过 GET /api/applications/:id/messages 查询
- **THEN** 返回应用关联的所有消息
- **AND** 按时间戳正序排列
- **AND** 包含用户消息和助手消息（chat 和 tool 类型）

#### Scenario: 分页查询消息
- **WHEN** 添加 page 和 pageSize 参数
- **THEN** 返回分页的消息列表
- **AND** 包含总数

### Requirement: Real-time Status Notification
系统 MUST 在应用状态变更时通过 Socket 推送通知。

#### Scenario: 状态变更通知
- **WHEN** 应用状态从 'created' 变为 'processing'
- **THEN** 向 session_${applicationId} room 推送 app:status:update 事件
- **AND** 事件包含 applicationId、newStatus、timestamp

#### Scenario: 进度更新通知
- **WHEN** PPT 生成进度更新
- **THEN** 推送 app:progress:update 事件
- **AND** 事件包含 progress（0-100）、message、currentStage

## MODIFIED Requirements

### Requirement: User Intent Classification
系统 MUST 支持从应用的 inputType 推断用户意图。

#### Scenario: 从应用类型推断意图
- **WHEN** 应用创建时指定了 inputType
- **THEN** 系统根据输入类型预填充意图分类
- **AND** file 类型默认为 INITIAL 意图
- **AND** url 类型默认为 INITIAL 意图
- **AND** text 类型根据内容长度和关键词判断意图
