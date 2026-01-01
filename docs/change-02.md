# AnyGen Backend Integration Guide (Agent Interaction Flow v2)

本指南旨在指导服务端如何对接增强后的 Agent 交互流程。主要变更涉及任务规划（Plan）的流式同步、工具产物（Artifacts）的实时生成以及完成状态的自动联动。

## 1. 通信协议变更概览

通信基于 **Socket.io**。除原有的 `message:chunk`, `thought:update` 外，新增/增强了以下事件。

---

## 2. 核心事件定义

### 2.1 任务规划更新 `plan:update` [NEW]
当 Agent 生成或更新其执行计划时，服务端应发送此事件。前端会根据此数据渲染 Todo List 及其完成状态。

- **Event Name**: `plan:update`
- **Direction**: Server -> Client
- **Payload Structure**:
```json
{
  "artifactId": "plan-123",
  "tasks": [
    { "id": "t1", "content": "搜索相关资料", "status": "completed" },
    { "id": "t2", "content": "分析并整理大纲", "status": "in_progress" },
    { "id": "t3", "content": "生成幻灯片内容", "status": "pending" }
  ]
}
```

### 2.2 工具产物生成 `tool:artifact` [NEW]
当 Agent 调用工具（如 Search, Browser）并产生结构化结果时，应发送此事件。

- **Event Name**: `tool:artifact`
- **Direction**: Server -> Client
- **Payload Structure**:
```json
{
  "messageId": "msg-456",
  "showInCanvas": true, 
  "artifact": {
    "id": "art-789",
    "type": "search_result", 
    "timestamp": 1700000000000,
    "content": {
      "query": "LangChain ReAct agent",
      "results": [
        { "title": "...", "url": "...", "snippet": "..." }
      ]
    }
  }
}
```
*注：`showInCanvas: true` 会使前端自动将该产物置于右侧画布焦点。*

### 2.3 工具执行日志 `tool:log` [ENHANCED]
增强现有的日志事件，关联产物 ID。

- **Payload Structure**:
```json
{
  "messageId": "msg-456",
  "log": {
    "id": "log-001",
    "tool": "Google Search",
    "action": "搜索 LangChain 相关资料",
    "status": "done",
    "artifactId": "art-789" 
  }
}
```
*注：携带 `artifactId` 后，前端日志条目会出现“查看”按钮。*

### 2.4 任务完成 `completion` [ENHANCED]
增强完成事件，支持自动展示最终产物。

- **Payload Structure**:
```json
{
  "success": true,
  "finalArtifactId": "art-final-pptx",
  "result": { "summary": "已完成 3 张幻灯片的生成。" }
}
```

---

## 3. 产物类型 (Artifact Types) 定义

服务端在发送 `artifact` 时，应遵循以下 `type` 和 `content` 规范：

| Type | 描述 | Content 结构示例 |
| :--- | :--- | :--- |
| `plan` | 执行计划 | `{ "title": "...", "tasks": [...] }` |
| `search_result` | 搜索结果 | `{ "query": "...", "results": [{ "title", "url", "snippet" }] }` |
| `web_page` | 网页快照 | `{ "url": "...", "screenshot": "base64...", "html": "..." }` |
| `dsl` | 幻灯片定义 | `{ "title": "...", "slides": [...] }` |
| `pptx` | 文件下载 | `{ "filename": "...", "downloadUrl": "..." }` |

---

## 4. 推荐的执行序列

1. **[Connect]**: 建立 Socket 连接。
2. **[Plan Initial]**: 发送 `plan:update` (全部状态为 `pending`)。
3. **[Execution]**: 
   - 发送 `thought:update` 展示思考。
   - 更新 `plan:update` (某项变为 `in_progress`)。
   - 调用工具并发送 `tool:log` + `tool:artifact`。
   - 更新 `plan:update` (该项变为 `completed`)。
4. **[Final Result]**: 发送 `artifact:update` (最终产物) 并触发 `completion`。

---

## 5. 调试建议

前端在 `localStorage` 中开启了 Socket 日志记录，您可以在控制台查看 `Socket Logs` 标签页，实时监控发送给前端的 Payload 是否符合上述结构。
