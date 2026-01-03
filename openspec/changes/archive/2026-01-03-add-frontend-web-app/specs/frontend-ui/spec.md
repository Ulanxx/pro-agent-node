## ADDED Requirements

### Requirement: 首页界面
前端应用 MUST 提供一个首页界面，包含大输入框和应用列表展示。

#### Scenario: 用户访问首页
- **WHEN** 用户访问根路径 `/`
- **THEN** 显示居中的大输入框和标题
- **AND** 显示"我的"和"探索版本"两个标签页
- **AND** 显示应用卡片网格布局

#### Scenario: 用户输入创建描述
- **WHEN** 用户在输入框中输入 PPT 创建描述
- **AND** 点击提交按钮
- **THEN** 调用 `POST /api/applications` API 创建应用
- **AND** 跳转到应用详情页

#### Scenario: 显示应用列表
- **WHEN** 首页加载完成
- **THEN** 调用 `GET /api/applications` API 获取用户的应用列表
- **AND** 以卡片形式展示每个应用
- **AND** 每个卡片显示应用标题、创建时间和状态

### Requirement: 详情页界面
前端应用 MUST 提供应用详情页，采用左右分栏布局。

#### Scenario: 用户访问详情页
- **WHEN** 用户访问 `/detail/:id` 路径
- **THEN** 左侧显示 ChatBot 对话区域
- **AND** 右侧显示生成的物料和最终产物
- **AND** 顶部显示返回按钮

#### Scenario: 左侧 ChatBot 区域
- **WHEN** 详情页加载完成
- **THEN** 左侧显示历史消息列表
- **AND** 底部显示消息输入框
- **AND** 支持发送文本消息

#### Scenario: 右侧物料展示区域
- **WHEN** 详情页加载完成
- **THEN** 右侧显示所有生成的 Artifacts
- **AND** 以卡片形式展示每个 Artifact
- **AND** 支持预览和下载 Artifact

### Requirement: 深色主题
前端应用 MUST 提供深色主题，参考 Genspark 的设计风格。

#### Scenario: 应用主题
- **WHEN** 应用加载
- **THEN** 默认使用深色主题
- **AND** 使用 Ant Design 的暗色主题配置
- **AND** 使用 Tailwind CSS 的深色色板

### Requirement: 响应式布局
前端应用 MUST 支持响应式布局，适配不同屏幕尺寸。

#### Scenario: 桌面端显示
- **WHEN** 屏幕宽度大于 1024px
- **THEN** 详情页左右分栏各占 50%
- **AND** 首页应用卡片每行显示 4 个

#### Scenario: 平板端显示
- **WHEN** 屏幕宽度在 768px 到 1024px 之间
- **THEN** 详情页左右分栏各占 50%
- **AND** 首页应用卡片每行显示 2-3 个

#### Scenario: 移动端显示
- **WHEN** 屏幕宽度小于 768px
- **THEN** 详情页改为上下布局
- **AND** 首页应用卡片每行显示 1 个

### Requirement: 加载状态
前端应用 MUST 在数据加载时显示加载状态。

#### Scenario: API 请求加载
- **WHEN** 发起 API 请求
- **THEN** 显示加载指示器
- **AND** 禁用相关操作按钮

#### Scenario: 加载完成
- **WHEN** API 请求完成
- **THEN** 隐藏加载指示器
- **AND** 显示数据或错误信息

### Requirement: 错误处理
前端应用 MUST 优雅地处理错误情况。

#### Scenario: API 请求失败
- **WHEN** API 请求返回错误
- **THEN** 显示用户友好的错误提示
- **AND** 提供重试选项

#### Scenario: 网络断开
- **WHEN** 检测到网络断开
- **THEN** 显示网络断开提示
- **AND** 自动重试连接
