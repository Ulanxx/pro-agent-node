# Change: 实现基于应用的会话式工作流

## Why

当前系统缺少按应用维度的完整工作流支持。用户需要一个统一的入口来创建和管理 PPT 生成任务，主要问题包括：

1. **缺少应用管理接口**：没有统一的入口来创建应用会话和跟踪应用状态
2. **文件上传支持不足**：当前只通过 Socket 接收文件信息，缺少标准的 REST API 来处理文件上传、URL 解析和文本输入
3. **数据持久化缺失**：所有数据都存储在 Redis 中，没有落库，导致数据容易丢失且无法查询历史记录
4. **Artifact 存储不完整**：生成的 artifact（PPT 文件、中间产物）没有持久化到 OSS，无法长期保存和访问
5. **Redis 使用不明确**：需要明确 Redis 在新架构中的定位（缓存 vs 持久化）

## What Changes

### 核心新增功能

1. **应用管理 API**
   - 创建应用会话（POST /api/applications）
   - 获取应用详情（GET /api/applications/:id）
   - 查询应用列表（GET /api/applications）
   - 更新应用状态（PATCH /api/applications/:id/status）

2. **统一输入处理 API**
   - 文件上传（POST /api/applications/:id/upload-file）
   - URL 解析（POST /api/applications/:id/parse-url）
   - 文本输入（POST /api/applications/:id/input-text）
   - 开始生成流程（POST /api/applications/:id/start）

3. **存储架构改造**
   - 新增 MySQL 实体：Application、Message、Artifact、Task
   - 集成 Bunny Storage 存储 artifact 文件（CDN 加速）
   - 保留 Redis 用于缓存和实时通信
   - 数据库迁移脚本

4. **增强的查询功能**
   - 查询应用历史（GET /api/applications?userId=xxx&status=xxx）
   - 获取 artifact 列表（GET /api/applications/:id/artifacts）
   - 下载 artifact（GET /api/artifacts/:id/download）
   - 获取消息历史（GET /api/applications/:id/messages）

### 改进点

- RESTful API 设计，便于前端调用
- 支持多种输入方式（文件、URL、文本）
- 完整的数据持久化，支持历史查询
- Bunny Storage 集成，全球 CDN 加速，成本低
- Redis 作为缓存层，提升性能

## Impact

### Affected Specs
- 新增 `application-management` spec - 应用生命周期管理
- 新增 `artifact-storage` spec - Artifact 存储和检索
- 修改 `agent-interaction` spec - 适配新的应用工作流
- 修改 `socket-communication` spec - Socket 事件与应用关联

### Affected Code
- `src/modules/application/` - 新增应用管理模块
- `src/modules/storage/` - 新增存储模块（Bunny Storage + MySQL）
- `src/modules/agent/chat.service.ts` - 适配新的数据持久化逻辑
- `src/modules/socket/socket.gateway.ts` - 更新 Socket 事件处理
- `src/shared/types/` - 新增应用相关的类型定义
- 新增数据库 migration 文件

### Migration
- 需要 MySQL 数据库迁移
- 需要配置 Bunny Storage（STORAGE_ZONE, HOSTNAME, ACCESS_KEY, PUBLIC_BASE_URL）
- Redis 数据结构保持兼容
- 需要提供数据迁移工具，将现有 Redis 数据迁移到 MySQL
