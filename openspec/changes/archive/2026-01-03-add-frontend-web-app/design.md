# 前端应用技术设计

## Context
Pro-Agent 是一个智能 PPT 生成系统，后端基于 NestJS 提供 REST API 和 WebSocket 服务。前端需要提供类似 Genspark 的用户体验，包括首页输入、应用列表、详情页实时交互等功能。

## Goals / Non-Goals

### Goals
- 构建现代化、响应式的 Web 应用
- 提供流畅的用户体验和实时反馈
- 实现与后端 API 和 WebSocket 的完整集成
- 参考 Genspark 的设计风格，提供深色主题和优雅的 UI

### Non-Goals
- 不实现移动端原生应用
- 不支持 IE 浏览器
- 暂不实现用户认证系统（使用 mock userId）

## Decisions

### 技术栈选择
- **构建工具**: Vite - 快速的开发服务器和构建工具
- **框架**: React 18 - 成熟的组件化框架
- **UI 组件库**: Ant Design 6 + AntdX - 企业级组件库
- **样式方案**: Tailwind CSS - 实用优先的 CSS 框架
- **路由**: TanStack Router - 类型安全的路由方案
- **状态管理**: TanStack Query - 服务端状态管理
- **WebSocket**: Socket.io-client - 与后端保持一致

**理由**: 
- Vite 提供极快的开发体验
- React 生态成熟，团队熟悉
- Ant Design 提供丰富的企业级组件
- TanStack 系列工具提供类型安全和优秀的开发体验
- Tailwind CSS 便于快速构建现代化 UI

### 架构模式

#### 目录结构
```
frontend/
├── src/
│   ├── components/       # 通用组件
│   │   ├── ui/          # 基础 UI 组件
│   │   ├── chat/        # 聊天相关组件
│   │   └── artifact/    # 物料展示组件
│   ├── pages/           # 页面组件
│   │   ├── home/        # 首页
│   │   └── detail/      # 详情页
│   ├── hooks/           # 自定义 Hooks
│   │   ├── useWebSocket.ts
│   │   └── useApplication.ts
│   ├── services/        # API 服务
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── routes/          # 路由配置
│   ├── styles/          # 全局样式
│   └── types/           # TypeScript 类型定义
├── public/              # 静态资源
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

#### 状态管理策略
- **服务端状态**: 使用 TanStack Query 管理 API 数据
- **WebSocket 状态**: 使用自定义 Hook 封装 Socket.io 逻辑
- **本地 UI 状态**: 使用 React useState/useReducer
- **路由状态**: 使用 TanStack Router 管理

#### 页面布局

**首页 (Home)**
```
┌─────────────────────────────────────┐
│         Genspark AI 幻灯片          │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 请输入你的需求文本主题和想要…  │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  我的  |  探索版本                  │
│  ┌──────┬──────┬──────┬──────┐    │
│  │ 模板 │ 模板 │ 模板 │ 模板 │    │
│  │  1   │  2   │  3   │  4   │    │
│  └──────┴──────┴──────┴──────┘    │
└─────────────────────────────────────┘
```

**详情页 (Detail)**
```
┌─────────────────────────────────────────────┐
│  ← 返回                                     │
├──────────────┬──────────────────────────────┤
│              │                              │
│   ChatBot    │      生成的物料和产物         │
│              │                              │
│  ┌────────┐  │  ┌────────┐  ┌────────┐     │
│  │ 用户   │  │  │ Slide  │  │ Slide  │     │
│  │ 消息   │  │  │   1    │  │   2    │     │
│  └────────┘  │  └────────┘  └────────┘     │
│  ┌────────┐  │                              │
│  │ AI     │  │  ┌────────────────────┐     │
│  │ 回复   │  │  │  最终 PPT 下载     │     │
│  └────────┘  │  └────────────────────┘     │
│              │                              │
│  ┌────────┐  │                              │
│  │ 输入框 │  │                              │
│  └────────┘  │                              │
└──────────────┴──────────────────────────────┘
```

### API 集成

#### REST API
- 使用 Axios 封装 HTTP 请求
- 基础 URL: `http://localhost:3000/api`
- 错误处理: 统一拦截器处理
- 类型定义: 根据 `FRONTEND_INTEGRATION_GUIDE.md` 定义 TypeScript 类型

#### WebSocket
- 连接 URL: `http://localhost:3000`
- 自动重连机制
- 事件监听封装在自定义 Hook 中
- 支持订阅应用更新、进度推送、消息推送等

### UI/UX 设计原则

#### 主题
- 深色主题为主（参考 Genspark）
- 支持浅色主题切换（可选）
- 使用 Ant Design 的主题定制功能

#### 交互
- 首页输入框支持多行文本
- 实时显示生成进度
- 平滑的页面过渡动画
- 响应式布局，支持不同屏幕尺寸

#### 组件设计
- 使用 Ant Design 组件作为基础
- 使用 Tailwind CSS 进行样式定制
- 使用 Lucide React 图标库

## Risks / Trade-offs

### 风险
1. **WebSocket 连接稳定性**: 网络不稳定可能导致连接中断
   - **缓解**: 实现自动重连和状态恢复机制

2. **实时数据同步**: 多个 WebSocket 事件可能导致状态不一致
   - **缓解**: 使用 TanStack Query 的缓存失效机制

3. **首次加载性能**: 大量依赖可能导致首次加载慢
   - **缓解**: 使用 Vite 的代码分割和懒加载

### 权衡
- **类型安全 vs 开发速度**: 选择完整的 TypeScript 类型定义，虽然初期开发稍慢，但长期维护性更好
- **组件库 vs 自定义**: 使用 Ant Design 减少开发时间，但可能牺牲一些设计灵活性

## Migration Plan

### 阶段 1: 项目初始化
1. 使用 Vite 创建 React + TypeScript 项目
2. 安装并配置所有依赖
3. 配置 Tailwind CSS 和 Ant Design
4. 设置 ESLint 和 Prettier

### 阶段 2: 基础设施
1. 实现 API 服务层
2. 实现 WebSocket 连接管理
3. 配置 TanStack Query 和 Router
4. 创建基础布局组件

### 阶段 3: 功能实现
1. 实现首页（输入框 + 应用列表）
2. 实现详情页（ChatBot + 物料展示）
3. 实现 WebSocket 实时更新
4. 实现错误处理和加载状态

### 阶段 4: 优化和测试
1. 性能优化
2. 响应式适配
3. 端到端测试
4. 文档编写

### 回滚计划
- 前端应用独立部署，不影响现有后端服务
- 可以随时回退到无前端状态

## Open Questions
1. 是否需要实现用户认证系统？（当前使用 mock userId）
2. 是否需要支持多语言？
3. 是否需要实现 PWA 功能？
4. 生成的 PPT 预览是使用 iframe 还是自定义渲染？
