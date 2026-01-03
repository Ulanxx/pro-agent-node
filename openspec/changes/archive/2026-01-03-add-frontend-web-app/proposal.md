# Change: 添加基于 React 的现代化前端 Web 应用

## Why
当前系统仅提供后端 API 和 WebSocket 服务，缺少用户友好的前端界面。需要构建一个类似 Genspark 的现代化 Web 应用，让用户能够通过直观的界面创建和管理 PPT 生成任务，实时查看生成进度和结果。

## What Changes
- 在 `frontend/` 目录下创建基于 React + Vite 的单页应用
- 实现首页大输入框和应用列表展示
- 实现详情页左右分栏布局（左侧 ChatBot，右侧物料展示）
- 集成 Ant Design 6 + AntdX 组件库和 Tailwind CSS
- 使用 TanStack Query 管理服务端状态
- 使用 TanStack Router 管理路由
- 实现 WebSocket 实时通信
- 参考 Genspark 的深色主题和现代化 UI 设计

## Impact
- **新增能力**: `frontend-ui`, `frontend-routing`, `frontend-state`
- **影响的代码**: 
  - 新增 `frontend/` 目录及所有前端代码
  - 可能需要调整后端 CORS 配置以支持前端开发
- **依赖关系**: 依赖现有的 REST API 和 WebSocket 接口（参考 `FRONTEND_INTEGRATION_GUIDE.md`）
