# agent-interaction Spec Delta

## MODIFIED Requirements

### Requirement: Session Initialization
系统 MUST 支持通过 applicationId 初始化会话，替代原有的 sessionId。

#### Scenario: 通过 applicationId 初始化会话
- **WHEN** 客户端发送 chat:init 事件，包含 applicationId
- **THEN** 从 MySQL 加载应用的消息历史和 artifacts
- **AND** 同时从 Redis 加载缓存数据（如果存在）
- **AND** 合并数据后返回给客户端
- **AND** 将客户端加入 session_${applicationId} room

#### Scenario: 新应用会话初始化
- **WHEN** applicationId 存在但没有任何消息
- **THEN** 返回空的历史和空 artifacts
- **AND** 状态为 ready

### Requirement: Message History Persistence
系统 MUST 将所有消息同时持久化到 MySQL 和缓存到 Redis。

#### Scenario: 保存用户消息到 MySQL
- **WHEN** 用户发送消息
- **THEN** 在 messages 表中创建记录
- **AND** 包含 applicationId、role、content、timestamp
- **AND** 同时保存到 Redis 缓存

#### Scenario: 保存助手消息到 MySQL
- **WHEN** 助手生成回复（chat 或 tool 消息）
- **THEN** 在 messages 表中创建记录
- **AND** 包含 id、applicationId、role、kind、content、metadata、timestamp
- **AND** 同时更新 Redis 缓存

#### Scenario: 消息历史查询优先级
- **WHEN** 查询消息历史
- **THEN** 优先从 Redis 缓存读取
- **AND** 如果缓存未命中，从 MySQL 读取
- **AND** 读 MySQL 后回写 Redis 缓存

### Requirement: Artifact Lifecycle Management
系统 MUST 将所有生成的 artifact 持久化到 Bunny Storage 和 MySQL。

#### Scenario: 工具生成 artifact
- **WHEN** 工具执行产生 artifact（如 dsl、pptx）
- **THEN** 将 artifact 上传到 Bunny Storage
- **AND** 在 artifacts 表创建记录，关联 applicationId
- **AND** 在 Redis 中缓存 artifact ID
- **AND** 通过 Socket 推送 tool:artifact 事件
- **AND** 事件包含 artifactId 和基础信息

#### Scenario: Artifact 关联到应用
- **WHEN** artifact 创建成功
- **THEN** 更新应用的 updatedAt 时间戳
- **AND** 推送 app:progress:update 事件，包含 artifactId

### Requirement: Task Tracking
系统 MUST 在 MySQL 中记录所有任务的执行状态和层级关系。

#### Scenario: 任务开始执行
- **WHEN** AutonomousPlanning 或 5Stage 流程开始执行任务
- **THEN** 在 tasks 表创建记录
- **AND** 包含 applicationId、name、description、status='in_progress'
- **AND** 推送 Socket 进度事件

#### Scenario: 任务完成
- **WHEN** 任务执行完成
- **THEN** 更新任务状态为 'completed'
- **AND** 记录 completed_at 时间戳
- **AND** 保存任务输出到 metadata

#### Scenario: 任务失败
- **WHEN** 任务执行失败
- **THEN** 更新任务状态为 'failed'
- **AND** 在 metadata 中记录错误信息
- **AND** 推送错误通知

#### Scenario: 任务层级关系
- **WHEN** 创建子任务
- **THEN** 记录 parentTaskId
- **AND** 支持查询任务的完整树形结构

### Requirement: Graph State Persistence
系统 MUST 将 LangGraph 的状态持久化到 MySQL 以支持中断恢复。

#### Scenario: Graph 节点完成状态保存
- **WHEN** AutonomousGraph 的某个节点执行完成
- **THEN** 在 tasks 表中标记该节点任务为 completed
- **AND** 保存节点的输出状态到 metadata
- **AND** 便于后续从中断点恢复

#### Scenario: Graph 中断恢复
- **WHEN** 图执行因错误中断
- **THEN** 从 MySQL 查询最后完成的节点
- **AND** 从下一个节点恢复执行
- **AND** 不重新执行已完成的节点

### Requirement: Intent Classification Enhancement
系统 MUST 基于应用的 inputType 和内容来推断用户意图。

#### Scenario: 从应用输入推断意图
- **WHEN** 应用创建时指定了 inputType='file'
- **THEN** 默认意图为 INITIAL
- **AND** 优先基于文件内容分析主题

#### Scenario: URL 输入的意图推断
- **WHEN** inputType='url'
- **THEN** 解析 URL 后提取关键词
- **AND** 根据网页内容推断是否需要生成 PPT

#### Scenario: 文本输入的意图推断
- **WHEN** inputType='text'
- **AND** 文本包含"帮我做"、"生成"等关键词
- **THEN** 识别为 INITIAL 意图
- **AND** 如果应用已有产物且文本包含"修改"、"优化"
- **THEN** 识别为 REFINEMENT 意图

### Requirement: Progress Reporting
系统 MUST 将任务的进度信息持久化到数据库并支持恢复。

#### Scenario: 保存任务进度
- **WHEN** 执行长时间任务（如 PPT 生成）
- **THEN** 在 Redis 中缓存当前进度（0-100）
- **AND** 定期（如每 5 秒）将进度保存到 applications 表的 metadata
- **AND** 便于用户刷新页面后恢复进度显示

#### Scenario: 进度恢复
- **WHEN** 用户重新连接 Socket
- **THEN** 从 MySQL 加载最新进度
- **AND** 推送 app:progress:update 事件
- **AND** 前端恢复进度显示

## REMOVED Requirements

无移除的需求，仅修改现有需求的实现方式。
