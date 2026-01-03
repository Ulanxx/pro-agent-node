# Tasks: 实现基于应用的会话式工作流

## Phase 1: 基础设施搭建

- [x] 1.1 安装必要的依赖包
  - TypeORM（MySQL ORM）
  - bunny-sdk 或 axios（Bunny Storage 客户端）
  - Multer（文件上传）
  - @nestjs/config（配置管理）
  - 相关类型定义
  - class-validator, class-transformer
  - cheerio（URL 解析）

- [x] 1.2 配置数据库连接
  - 更新 .env 配置模板
  - 添加 MySQL 连接配置
  - 添加 Bunny Storage 配置项（STORAGE_ZONE, HOSTNAME, ACCESS_KEY, PUBLIC_BASE_URL）
  - 配置验证逻辑

- [ ] 1.3 创建数据库迁移脚本
  - 编写 applications 表迁移
  - 编写 messages 表迁移
  - 编写 artifacts 表迁移
  - 编写 tasks 表迁移
  - 测试迁移脚本

## Phase 2: 数据模型与实体

- [x] 2.1 创建 TypeORM 实体
  - Application 实体
  - Message 实体
  - Artifact 实体
  - Task 实体
  - 关联关系配置

- [x] 2.2 创建 DTO 类
  - CreateApplicationDto
  - UpdateApplicationDto
  - QueryApplicationsDto
  - UploadFileDto
  - ParseUrlDto
  - InputTextDto
  - StartGenerationDto

- [x] 2.3 创建响应类型
  - ApplicationResponseDto
  - MessageResponseDto
  - ArtifactResponseDto
  - TaskResponseDto
  - 分页响应类型

## Phase 3: 存储服务层

- [x] 3.1 实现 Bunny Storage 服务
  - Bunny Storage 客户端初始化
  - 上传文件方法（支持 Buffer 和 Stream）
  - 生成公共 CDN URL 方法
  - 删除文件方法
  - 单元测试（使用 Mock）

- [x] 3.2 实现数据库 Repository
  - ApplicationRepository
  - MessageRepository
  - ArtifactRepository
  - TaskRepository
  - 复杂查询方法

- [x] 3.3 实现 Redis 缓存服务
  - 缓存应用状态
  - 缓存消息历史
  - 缓存 artifact 索引
  - 缓存失效策略

## Phase 4: 业务服务层

- [x] 4.1 实现 ApplicationService
  - 创建应用
  - 查询应用详情
  - 查询应用列表（分页）
  - 更新应用状态
  - 删除应用（软删除）

- [x] 4.2 实现 FileProcessingService
  - 处理文件上传
  - 文件类型验证
  - 文件大小限制
  - 上传到 Bunny Storage
  - 保存文件元数据

- [x] 4.3 实现 UrlParsingService
  - 解析 URL 内容
  - 提取标题和正文
  - 处理错误 URL
  - 保存解析结果

- [x] 4.4 实现 ArtifactService
  - 创建 artifact 记录
  - 上传 artifact 到 Bunny Storage
  - 查询 artifact 列表
  - 生成下载链接
  - 关联 artifact 到应用

- [x] 4.5 实现 TaskService
  - 创建任务记录
  - 更新任务状态
  - 查询任务树
  - 任务进度计算

- [ ] 4.6 改造 ChatService
  - 适配新的数据持久化
  - 消息保存到 MySQL
  - artifact 保存到 Bunny Storage
  - 保持 Redis 缓存同步

## Phase 5: API 控制器层

- [x] 5.1 实现 ApplicationController
  - POST /api/applications - 创建应用
  - GET /api/applications/:id - 获取应用详情
  - GET /api/applications - 查询应用列表
  - PATCH /api/applications/:id/status - 更新状态
  - DELETE /api/applications/:id - 删除应用

- [x] 5.2 实现输入处理控制器
  - POST /api/applications/:id/upload-file - 上传文件
  - POST /api/applications/:id/parse-url - 解析 URL
  - POST /api/applications/:id/input-text - 提交文本
  - POST /api/applications/:id/start - 开始生成

- [x] 5.3 实现 ArtifactController
  - GET /api/applications/:id/artifacts - 获取 artifact 列表
  - GET /api/artifacts/:id/download - 下载 artifact
  - GET /api/artifacts/:id - 获取 artifact 详情

- [x] 5.4 实现 MessageController
  - GET /api/applications/:id/messages - 获取消息历史
  - POST /api/applications/:id/messages - 发送消息（REST 方式）

## Phase 6: Socket 网关更新

- [ ] 6.1 更新 SocketGateway
  - 添加 app:subscribe 事件处理
  - 添加 app:status:update 事件推送
  - 添加 app:progress:update 事件推送
  - 添加 artifact:created 事件推送

- [ ] 6.2 适配现有 Socket 事件
  - 更新 chat:init 事件（加载 MySQL 数据）
  - 更新 chat:send 事件（保存到 MySQL）
  - 保持向后兼容

- [ ] 6.3 实现实时推送
  - 应用状态变更推送
  - 消息推送
  - artifact 创建推送
  - 任务进度推送

## Phase 7: Agent 服务集成

- [ ] 7.1 更新 AgentService
  - 适配新的应用模型
  - 使用 ApplicationService 创建应用
  - 保存生成的 artifact

- [ ] 7.2 更新 AutonomousGraphService
  - 保存任务到 MySQL
  - 实时更新任务状态
  - 保存中间 artifact

- [ ] 7.3 更新 TaskExecutor
  - 记录任务开始/结束时间
  - 保存任务输出
  - 错误处理和重试

## Phase 8: 数据迁移工具

- [ ] 8.1 实现 Redis 到 MySQL 迁移
  - 扫描 Redis 中的历史数据
  - 转换为 MySQL 实体
  - 批量导入到 MySQL
  - 迁移脚本

- [ ] 8.2 实现迁移回滚工具
  - 备份 MySQL 数据
  - 清理迁移数据
  - 恢复 Redis 数据

## Phase 9: 测试

- [ ] 9.1 单元测试
  - ApplicationService 测试
  - FileProcessingService 测试
  - UrlParsingService 测试
  - ArtifactService 测试
  - OSS Service 测试（Mock）

- [ ] 9.2 集成测试
  - API 控制器测试
  - 数据库操作测试
  - Socket 事件测试
  - 完整流程测试

- [ ] 9.3 E2E 测试
  - 创建应用流程
  - 文件上传流程
  - PPT 生成流程
  - 历史查询流程

## Phase 10: 文档与部署

- [ ] 10.1 API 文档
  - 更新 Swagger 文档
  - 添加请求/响应示例
  - 添加错误码说明

- [ ] 10.2 部署文档
  - 环境变量说明
  - 数据库初始化步骤
  - OSS 配置指南
  - 迁移步骤说明

- [ ] 10.3 前端对接文档
  - API 使用示例
  - Socket 事件说明
  - 前端状态管理建议
  - 错误处理建议

## 依赖关系

- Phase 1 必须最先完成
- Phase 2 依赖于 Phase 1
- Phase 3 依赖于 Phase 2
- Phase 4 依赖于 Phase 3
- Phase 5 依赖于 Phase 4
- Phase 6 可以与 Phase 5 并行
- Phase 7 依赖于 Phase 5 和 Phase 6
- Phase 8 可以独立进行
- Phase 9 依赖于前面的所有实现
- Phase 10 在 Phase 9 完成后进行

## 并行化建议

可以并行的任务组：
- Group 1: Phase 2, Phase 3（在 Phase 1 完成后）
- Group 2: Phase 5.1, Phase 5.2, Phase 5.3, Phase 5.4（在 Phase 4 完成后）
- Group 3: Phase 9.1, Phase 9.2, Phase 9.3（在实现阶段并行编写）

## 验收标准

每个 Phase 完成后：
- 所有代码通过 ESLint 和 Prettier 检查
- 单元测试覆盖率 > 80%
- 集成测试通过
- API 文档更新
- 代码审查通过

最终验收：
- 完整的创建应用 → 上传文件 → 生成 PPT → 查询历史流程可运行
- 所有 E2E 测试通过
- 性能测试达标（响应时间 < 500ms for API）
- 文档完整
- 代码审查通过
