# AnyGen Backend 对接文档 (Thinking-Artifact 联动版)

本文档旨在说明 AnyGen Frontend 如何处理 Socket 事件，特别是如何通过 `artifactId` 实现 AI 思考过程与右侧产物卡片的点击跳转定位。

## 1. 通信协议概览
- **传输层**: Socket.io
- **默认端口**: 3000
- **基本流程**: 客户端发送指令 -> 后端流式推送进度与产物 -> 后端发送完成信号。

## 2. 核心事件定义

### 2.1 任务进度同步 (`progress`)
后端通过此事件推送全局任务状态。

*   **用途**: 更新聊天框下方的蓝色进度条。
*   **关键约束**: 如果当前正在生成的步骤对应右侧某个产物，**必须**携带 `artifactId`。

```json
// 事件名: progress
{
  "status": "GENERATING",      // 状态标签 (如: PLANNING, GATHERING, GENERATING)
  "progress": 50,              // 进度百分比 (0-100)
  "message": "正在生成详细内容...", // 详细描述
  "artifactId": "slide_page_1" // 可选：指向右侧产物的 ID，提供后前端支持点击定位
}
```

### 2.2 思考步骤更新 (`thought:update`)
后端通过此事件推送消息内部的细粒度思考链。

*   **用途**: 展示 AI 的思考逻辑。
*   **关键约束**: `thought.artifactId` 用于实现思考步骤与产物的精准绑定。

```json
// 事件名: thought:update
{
  "messageId": "msg_123",      // 关联的助理消息 ID
  "thought": {
    "id": "t_1",               // 步骤 ID
    "status": "completed",     // 状态: pending | in_progress | completed | error
    "content": "已完成大纲规划", // 步骤内容
    "artifactId": "plan_v1",   // 可选：指向对应的产物卡片 ID
    "subThoughts": []          // 可选：嵌套子步骤
  }
}
```

### 2.3 产物更新 (`artifact:update`)
后端推送生成的实质性内容（如 Plan, DSL, PPTX）。

*   **用途**: 在右侧画布区渲染产物。
*   **关键约束**: `id` 必须在整个生成会话中保持稳定。

```json
// 事件名: artifact:update
{
  "id": "slide_page_1",        // 产物唯一 ID (需与上述 artifactId 对应)
  "type": "dsl",               // 类型: plan | dsl | pptx
  "version": "v1.0",           // 版本标识
  "timestamp": 1703923200000,
  "content": {                 // 根据类型变化的业务数据
    "title": "页面 1",
    "slides": [...] 
  }
}
```

## 3. 业务模型约束

### 3.1 产物类型定义
| 类型 (`type`) | 说明 | 推荐 `content` 结构 |
| :--- | :--- | :--- |
| `plan` | 演示文稿大纲 | `{ title: string, outline: Array<{ title, description, expectedComponents }> }` |
| `dsl` | 页面内容预览 | `{ title: string, slides: Array<{ title, elements: Array<{ type, content, layout }> }> }` |
| `pptx` | 最终文件下载 | `{ filename: string, downloadUrl: string }` |

### 3.2 联动逻辑逻辑
1.  后端在发送 `progress` 或 `thought:update` 时，如果其中的 `artifactId` 指向了一个已发送（或即将发送）的 `artifact:update.id`。
2.  前端会自动将该进度条/思考步骤变为**可点击状态**。
3.  用户点击后，前端会通过 `id` 定位到右侧对应的卡片，并触发**高亮动画**。

## 4. 辅助事件

-   **`chat:send` (Client -> Server)**: 发送用户消息。格式：`{ message: string, sessionId: string }`。
-   **`completion` (Server -> Client)**: 任务结束。格式：`{ success: boolean, result?: any, error?: string }`。

---
**提示**: 前端当前采用最新产物在前（Prepend）的展示逻辑，请确保 `artifact:update` 推送的顺序符合业务预期。