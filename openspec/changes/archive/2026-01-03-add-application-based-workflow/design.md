# Design: 基于应用的会话式工作流架构设计

## 架构概览

### 系统分层

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  首页大输入框 → agent/$id 详情页 → Socket 实时更新           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ REST API + WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                         │
│  ApplicationController (REST) + SocketGateway (WebSocket)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Application   │  │Agent         │  │Storage       │      │
│  │Service       │  │Service       │  │Service       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │MySQL         │  │Redis         │  │Bunny Storage │      │
│  │(持久化)      │  │(缓存+队列)   │  │(文件存储+CDN)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 数据库设计

### MySQL Schema

#### applications 表
```sql
CREATE TABLE applications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  status ENUM('created', 'processing', 'completed', 'failed') DEFAULT 'created',
  input_type ENUM('text', 'file', 'url') NOT NULL,
  input_content TEXT,
  file_metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

#### messages 表
```sql
CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY,
  application_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  kind ENUM('chat', 'tool') DEFAULT 'chat',
  content TEXT,
  metadata JSON,
  timestamp BIGINT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  INDEX idx_application_id (application_id),
  INDEX idx_timestamp (timestamp)
);
```

#### artifacts 表
```sql
CREATE TABLE artifacts (
  id VARCHAR(36) PRIMARY KEY,
  application_id VARCHAR(36) NOT NULL,
  type ENUM('plan', 'dsl', 'ppt_html', 'ppt_html_doc', 'pptx', 'search_result', 'web_page',
            'requirement_analysis', 'course_config', 'video_outline', 'slide_scripts',
            'presentation_theme') NOT NULL,
  title VARCHAR(255),
  storage_path VARCHAR(512),
  storage_url VARCHAR(512),
  file_size BIGINT,
  metadata JSON,
  version VARCHAR(16) DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  INDEX idx_application_id (application_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
);
```

#### tasks 表
```sql
CREATE TABLE tasks (
  id VARCHAR(36) PRIMARY KEY,
  application_id VARCHAR(36) NOT NULL,
  parent_task_id VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('pending', 'in_progress', 'completed', 'failed', 'skipped') DEFAULT 'pending',
  task_type VARCHAR(64),
  metadata JSON,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  INDEX idx_application_id (application_id),
  INDEX idx_status (status),
  INDEX idx_parent_task_id (parent_task_id)
);
```

## Redis 使用场景

### 缓存策略

1. **应用状态缓存**
   - Key: `app:state:{applicationId}`
   - Value: JSON (当前状态、进度百分比)
   - TTL: 1小时
   - 用途: 快速访问应用状态，减少数据库查询

2. **消息历史缓存**
   - Key: `app:messages:{applicationId}`
   - Value: List (最近 100 条消息)
   - TTL: 24小时
   - 用途: Socket 连接时快速加载历史消息

3. **Artifact 索引缓存**
   - Key: `app:artifacts:{applicationId}`
   - Value: Set (artifact IDs)
   - TTL: 1小时
   - 用途: 快速获取应用的 artifact 列表

### BullMQ 队列

保留现有的 BullMQ 队列用于异步任务处理：
- `ppt-generation` - PPT 生成任务队列
- `file-processing` - 文件处理队列
- `url-parsing` - URL 解析队列

## API 接口设计

### 1. 应用管理

#### POST /api/applications
创建新的应用会话

**Request Body:**
```json
{
  "userId": "user123",
  "inputType": "text | file | url",
  "inputContent": "string",
  "title": "optional title"
}
```

**Response:**
```json
{
  "id": "app-uuid",
  "userId": "user123",
  "status": "created",
  "inputType": "text",
  "title": "PPT Title",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/applications/:id
获取应用详情

**Response:**
```json
{
  "id": "app-uuid",
  "userId": "user123",
  "title": "PPT Title",
  "status": "processing",
  "inputType": "text",
  "inputContent": "...",
  "metadata": {},
  "artifacts": [
    {
      "id": "artifact-uuid",
      "type": "pptx",
      "title": "Final PPT",
      "storageUrl": "https://pro-agent.b-cdn.net/artifacts/pptx/.../ppt.pptx",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "messages": [...],
  "tasks": [...],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:01:00Z"
}
```

#### GET /api/applications
查询应用列表

**Query Params:**
- `userId`: 用户 ID（必需）
- `status`: 状态筛选（可选）
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）

**Response:**
```json
{
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "items": [...]
}
```

### 2. 输入处理

#### POST /api/applications/:id/upload-file
上传文件

**Request:** multipart/form-data
- `file`: 文件
- `metadata`: JSON 字符串（可选）

**Response:**
```json
{
  "fileId": "file-uuid",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "storagePath": "uploads/2024/01/01/file-uuid.pdf",
  "storageUrl": "https://pro-agent.b-cdn.net/uploads/2024/01/01/file-uuid.pdf"
}
```

#### POST /api/applications/:id/parse-url
解析 URL

**Request Body:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "content": "...",
  "parsedAt": "2024-01-01T00:00:00Z"
}
```

#### POST /api/applications/:id/input-text
提交文本输入

**Request Body:**
```json
{
  "content": "帮我生成一个关于人工智能的PPT"
}
```

**Response:**
```json
{
  "applicationId": "app-uuid",
  "messageId": "msg-uuid",
  "status": "received"
}
```

### 3. 流程控制

#### POST /api/applications/:id/start
开始生成流程

**Request Body:**
```json
{
  "mode": "autonomous | 5-stage",
  "options": {}
}
```

**Response:**
```json
{
  "applicationId": "app-uuid",
  "status": "processing",
  "sessionId": "socket-session-id"
}
```

#### PATCH /api/applications/:id/status
更新应用状态

**Request Body:**
```json
{
  "status": "completed | failed | cancelled"
}
```

**Response:**
```json
{
  "id": "app-uuid",
  "status": "completed",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### 4. Artifact 管理

#### GET /api/applications/:id/artifacts
获取应用的 artifact 列表

**Response:**
```json
{
  "applicationId": "app-uuid",
  "artifacts": [...]
}
```

#### GET /api/artifacts/:id/download
下载 artifact

**Response:** File stream 或重定向到 Bunny CDN URL

## Socket 事件协议更新

### 客户端 → 服务器

- `chat:init` - 初始化聊天（加入应用房间）
- `chat:send` - 发送消息
- `app:subscribe` - 订阅应用更新

### 服务器 → 客户端

- `app:status:update` - 应用状态更新
- `app:progress:update` - 进度更新
- `message:start` - 消息开始
- `message:chunk` - 消息流式返回
- `tool:start` - 工具开始执行
- `tool:update` - 工具更新
- `tool:artifact` - artifact 生成通知
- `artifact:created` - 新 artifact 创建
- `error` - 错误通知

## Bunny Storage 集成方案

### 文件存储策略

1. **上传文件**
   - 路径: `uploads/{year}/{month}/{day}/{fileId}.{ext}`
   - 访问: 通过 CDN 公开访问（https://pro-agent.b-cdn.net/uploads/...）

2. **生成的 PPT 文件**
   - 路径: `artifacts/pptx/{applicationId}/{version}/{artifactId}.pptx`
   - 访问: 公开 CDN URL

3. **中间产物 JSON**
   - 路径: `artifacts/{type}/{applicationId}/{artifactId}.json`
   - 访问: 公开 CDN URL

### Bunny Storage 配置

环境变量配置：
```env
BUNNY_STORAGE_ZONE=pro-agent
BUNNY_STORAGE_HOSTNAME=uk.storage.bunnycdn.com
BUNNY_STORAGE_ACCESS_KEY=your-access-key
BUNNY_PUBLIC_BASE_URL=pro-agent.b-cdn.net
```

### 文件上传实现

使用 Bunny Storage API 上传文件：
```typescript
import { Storage } from 'bunny-sdk';

async uploadFile(
  file: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  const storage = new Storage({
    accessKey: process.env.BUNNY_STORAGE_ACCESS_KEY,
    storageZone: process.env.BUNNY_STORAGE_ZONE,
    hostname: process.env.BUNNY_STORAGE_HOSTNAME,
  });

  await storage.putFile(path, file, {
    contentType,
  });

  // 返回 CDN URL
  return `https://${process.env.BUNNY_PUBLIC_BASE_URL}/${path}`;
}
```

### 公共 URL 生成

Bunny Storage 所有文件都是公开的，直接拼接 CDN URL：
```typescript
getPublicUrl(storagePath: string): string {
  return `https://${process.env.BUNNY_PUBLIC_BASE_URL}/${storagePath}`;
}
```

## 数据同步策略

### 写入顺序
1. 先写 MySQL（保证持久化）
2. 再写 Redis 缓存（提升性能）
3. 发送 Socket 事件（实时通知）

### 读取顺序
1. 先读 Redis 缓存
2. 缓存未命中则读 MySQL
3. 读 MySQL 后回写 Redis

### 缓存失效
- 数据更新时删除对应缓存
- 采用 Cache Aside 模式

## 技术选型

### MySQL ORM
- 使用 TypeORM
- 推荐 TypeORM（NestJS 官方推荐）

### 文件存储
- Bunny Storage（高性价比 CDN 存储）
- 使用 bunny-sdk 或 fetch API 直连 Bunny Storage API
- 全球 CDN 加速，公开访问

### 文件上传
- 前端: multipart/form-data
- 后端: Multer 中间件处理内存中的文件
- 流式上传到 Bunny Storage，避免占用服务器内存

## 前端工作流

### 1. 首页
```
用户输入 → 创建应用 (POST /api/applications)
         → 跳转到 /agent/{applicationId}
```

### 2. Agent 详情页
```
初始化 → Socket 连接 → 加入房间 (app:subscribe)
      → 获取历史数据 (GET /api/applications/:id)
      → 渲染界面
      → 监听 Socket 事件实时更新
```

### 3. 开始生成
```
点击开始 → POST /api/applications/:id/start
         → 接收 Socket 进度事件
         → 实时展示进度
         → 完成后展示 artifact 列表
```

## 安全考虑

1. **用户隔离**: 所有查询必须带 userId
2. **文件上传限制**: 大小、类型限制
3. **URL 安全**: Bunny Storage 公开访问，通过 UUID 文件名防止遍历
4. **API 限流**: 防止滥用
5. **敏感数据**: Redis 不存储敏感信息
6. **CDN 访问控制**: 如需私有文件，可配置 Bunny Storage Token 认证（可选）

## 性能优化

1. **数据库索引**: 为常用查询字段添加索引
2. **缓存策略**: 热数据缓存
3. **分页查询**: 避免一次性加载大量数据
4. **异步处理**: 耗时操作使用 BullMQ 队列
5. **连接池**: 数据库和 Redis 连接池

## 监控与日志

1. **应用状态**: 跟踪应用创建、完成率
2. **任务耗时**: 监控每个阶段的处理时间
3. **错误率**: 任务失败、API 错误
4. **Bunny Storage 使用**: 存储空间、CDN 流量统计

## 兼容性

1. **现有 Socket 协议**: 保持兼容，逐步迁移
2. **Redis 数据**: 提供迁移工具
3. **API 版本**: 使用 `/api/v1` 前缀
