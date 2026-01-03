# artifact-storage Spec Delta

## ADDED Requirements

### Requirement: Artifact Persistence to Bunny Storage
系统 MUST 将所有生成的 artifact 文件存储到 Bunny Storage。

#### Scenario: 存储生成的 PPTX 文件
- **WHEN** PPT 生成完成，产生 pptx 类型的 artifact
- **THEN** 将 PPTX 文件上传到 Bunny Storage
- **AND** 文件路径格式：artifacts/pptx/{applicationId}/{version}/{artifactId}.pptx
- **AND** 在 artifacts 表中创建记录，包含 storagePath、storageUrl、fileSize
- **AND** 关联到对应的应用

#### Scenario: 存储中间产物 JSON
- **WHEN** 生成中间产物（如 dsl、course_config、video_outline）
- **THEN** 将 JSON 数据序列化后上传到 Bunny Storage
- **AND** 文件路径格式：artifacts/{type}/{applicationId}/{artifactId}.json
- **AND** 数据库中保存完整的 JSON 内容到 metadata 字段
- **AND** 便于快速查询和展示

#### Scenario: 存储网页搜索结果
- **WHEN** WebSearch 工具返回搜索结果
- **THEN** 将结果序列化为 JSON
- **AND** 上传到 artifacts/search_result/ 路径
- **AND** 在数据库中记录搜索关键词、结果数量、时间戳

#### Scenario: 存储解析的网页内容
- **WHEN** 通过 URL 解析获取网页内容
- **THEN** 将网页 HTML 和提取的文本保存
- **AND** 上传到 artifacts/web_page/ 路径
- **AND** 记录原始 URL、标题、解析时间

### Requirement: Artifact Metadata Storage
系统 MUST 在 MySQL 中存储 artifact 的完整元数据。

#### Scenario: 创建 artifact 记录
- **WHEN** 新 artifact 产生
- **THEN** 在 artifacts 表中创建记录，包含：
  - id: UUID
  - application_id: 关联的应用 ID
  - type: artifact 类型（枚举）
  - title: artifact 标题（可选）
  - storage_path: Bunny Storage 存储路径
  - storage_url: Bunny Storage CDN URL
  - file_size: 文件大小（字节）
  - metadata: JSON 元数据（包含实际内容或其他信息）
  - version: 版本号（默认 '1.0'）
  - created_at: 创建时间

#### Scenario: 保存 DSL 内容
- **WHEN** 保存 type='dsl' 的 artifact
- **THEN** metadata 字段包含完整的 AnyGenDocument JSON
- **AND** 便于前端直接从数据库获取 DSL 结构

#### Scenario: 保存 PPT HTML 文档
- **WHEN** 保存 type='ppt_html_doc' 的 artifact
- **THEN** metadata 字段包含 PptHtmlDocument JSON
- **AND** 包含所有页面的 HTML 内容

### Requirement: Artifact Retrieval
系统 MUST 支持查询应用的 artifact 列表。

#### Scenario: 查询所有 artifact
- **WHEN** 通过 GET /api/applications/:id/artifacts 查询
- **THEN** 返回该应用的所有 artifact
- **AND** 按创建时间倒序排列
- **AND** 包含基础信息和 Bunny CDN URL

#### Scenario: 按 type 筛选 artifact
- **WHEN** 添加 type 参数（如 ?type=dsl）
- **THEN** 只返回该类型的 artifact

#### Scenario: 查询单个 artifact 详情
- **WHEN** 通过 GET /api/artifacts/:id 查询
- **AND** artifact 存在
- **THEN** 返回完整的 artifact 信息
- **AND** 包含 metadata 中的完整内容

#### Scenario: 查询不存在的 artifact
- **WHEN** artifact ID 不存在
- **THEN** 返回 404 错误

### Requirement: Artifact Download
系统 MUST 支持下载 artifact 文件。

#### Scenario: 下载 PPTX 文件
- **WHEN** 用户通过 GET /api/artifacts/:id/download 请求下载
- **AND** artifact 类型为 pptx
- **THEN** 直接重定向到 Bunny CDN URL（文件公开访问）
- **AND** 或流式传输文件内容（如果需要统计下载次数）

#### Scenario: 下载 JSON 文件
- **WHEN** artifact 类型为 dsl、course_config 等 JSON 类型
- **THEN** 直接返回 JSON 内容
- **AND** Content-Type 设置为 application/json
- **AND** 支持浏览器下载

#### Scenario: 下载不存在的文件
- **WHEN** artifact 的 Bunny Storage 文件已被删除
- **THEN** 返回 404 错误
- **AND** 说明文件不存在

### Requirement: Public CDN URL Generation
系统 MUST 为存储在 Bunny Storage 的文件生成公共 CDN URL。

#### Scenario: 生成 CDN URL
- **WHEN** 需要提供给用户访问链接
- **THEN** 拼接 Bunny CDN 公共 URL
- **AND** 格式：https://{BUNNY_PUBLIC_BASE_URL}/{storagePath}
- **AND** URL 永久有效，无需签名

#### Scenario: 通过 URL 访问文件
- **WHEN** 用户访问 CDN URL
- **THEN** Bunny CDN 直接返回文件（或从边缘缓存返回）
- **AND** 无需额外认证

### Requirement: Artifact Caching
系统 MUST 在 Redis 中缓存 artifact 索引。

#### Scenario: 缓存应用 artifact 列表
- **WHEN** 查询应用的 artifact 列表
- **THEN** 首次从 MySQL 查询
- **AND** 将 artifact ID 列表缓存到 Redis
- **AND** Key: app:artifacts:{applicationId}
- **AND** TTL: 1 小时
- **AND** 后续查询优先从缓存读取

#### Scenario: 缓存失效
- **WHEN** 新 artifact 创建
- **THEN** 删除对应的 Redis 缓存
- **AND** 下次查询重新从 MySQL 加载

### Requirement: Artifact Size Limit
系统 MUST 限制单个 artifact 的大小。

#### Scenario: PPTX 文件大小限制
- **WHEN** 生成的 PPTX 文件超过 50MB
- **THEN** 触发警告
- **AND** 记录到日志
- **AND** 仍允许保存（但标记为 large）

#### Scenario: JSON 文件大小限制
- **WHEN** JSON artifact 超过 5MB
- **THEN** 检查是否合理
- **AND** 如果 DSL 过于复杂，建议拆分
- **AND** 记录警告日志

### Requirement: Artifact Versioning
系统 MUST 支持 artifact 的版本管理。

#### Scenario: 创建新版本 artifact
- **WHEN** 同一类型 artifact 重新生成
- **THEN** version 字段递增（1.0 → 2.0）
- **AND** 保留旧版本 artifact
- **AND** 在 metadata 中记录 parentArtifactId

#### Scenario: 查询特定版本
- **WHEN** 添加 version 参数查询
- **THEN** 返回指定版本的 artifact

### Requirement: Artifact Deletion
系统 MUST 支持删除 artifact。

#### Scenario: 删除 artifact
- **WHEN** 通过 DELETE /api/artifacts/:id 删除
- **AND** artifact 存在
- **THEN** 从 MySQL 删除记录
- **AND** 从 Bunny Storage 删除文件
- **AND** 清除 Redis 缓存
- **AND** 返回 204 No Content

#### Scenario: 批量删除 artifact
- **WHEN** 应用被删除时
- **THEN** 级联删除所有关联的 artifact
- **AND** 删除 Bunny Storage 上的所有文件
- **AND** 清除所有相关缓存

### Requirement: Artifact Statistics
系统 MUST 支持统计 artifact 信息。

#### Scenario: 查询应用的 artifact 统计
- **WHEN** 通过 GET /api/applications/:id/artifacts/stats 查询
- **THEN** 返回统计信息：
  - 总数
  - 按类型分组统计
  - 总存储大小
  - 最新创建时间

#### Scenario: 系统级 artifact 统计
- **WHEN** 管理员查询系统统计
- **THEN** 返回：
  - 总 artifact 数量
  - 总存储占用
  - 按类型分布
  - 按日期分布（最近 30 天）

## MODIFIED Requirements

### Requirement: Enhanced Tool Artifacts
系统 MUST 将所有 artifact 同时保存到 Bunny Storage 和 MySQL 以确保数据一致性。

#### Scenario: 保存到 Bunny Storage 和 MySQL
- **WHEN** 工具执行产生 artifact
- **THEN** 必须上传到 Bunny Storage
- **AND** 必须在 MySQL 创建记录
- **AND** 必须通过 Socket 推送 tool:artifact 事件
- **AND** 三者必须保持数据一致性

#### Scenario: Artifact 创建失败处理
- **WHEN** Bunny Storage 上传失败
- **THEN** 记录错误到日志
- **AND** 推送 tool:update 事件，status='failed'
- **AND** 不创建 MySQL 记录
- **AND** 回滚已执行的操作

### Requirement: Artifact Visualization Control
系统 MUST 从 MySQL metadata 字段加载 artifact 内容，大文件除外。

#### Scenario: 从 MySQL 加载 artifact
- **WHEN** 前端请求显示 artifact
- **THEN** 优先从 MySQL metadata 字段读取内容
- **AND** 如果 metadata 包含完整数据，直接返回
- **AND** 如果 metadata 只包含引用，则从 Bunny Storage 加载

#### Scenario: 大文件处理
- **WHEN** artifact 文件超过 1MB
- **THEN** metadata 只存储摘要信息
- **AND** 完整内容存储在 Bunny Storage
- **AND** 通过公共 CDN URL 访问
