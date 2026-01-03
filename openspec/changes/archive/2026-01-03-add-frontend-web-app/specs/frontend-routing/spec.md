## ADDED Requirements

### Requirement: 路由配置
前端应用 MUST 使用 TanStack Router 管理路由，提供类型安全的路由系统。

#### Scenario: 根路径路由
- **WHEN** 用户访问 `/`
- **THEN** 渲染首页组件
- **AND** 显示应用列表

#### Scenario: 详情页路由
- **WHEN** 用户访问 `/detail/:id`
- **THEN** 渲染详情页组件
- **AND** 根据 URL 参数加载对应应用数据

#### Scenario: 404 路由
- **WHEN** 用户访问不存在的路径
- **THEN** 显示 404 页面
- **AND** 提供返回首页的链接

### Requirement: 路由导航
前端应用 MUST 支持编程式导航和声明式导航。

#### Scenario: 编程式导航
- **WHEN** 创建应用成功
- **THEN** 使用 `navigate()` 跳转到详情页
- **AND** 传递应用 ID 参数

#### Scenario: 声明式导航
- **WHEN** 用户点击应用卡片
- **THEN** 使用 `<Link>` 组件跳转到详情页
- **AND** 保持类型安全

### Requirement: 路由参数
前端应用 MUST 支持路由参数的类型安全访问。

#### Scenario: 读取路由参数
- **WHEN** 详情页组件加载
- **THEN** 使用 `useParams()` 获取应用 ID
- **AND** 参数类型自动推断

#### Scenario: 路由参数验证
- **WHEN** 路由参数不符合预期格式
- **THEN** 显示错误页面
- **AND** 提供返回首页的选项

### Requirement: 路由守卫
前端应用 MUST 支持路由守卫，保护需要权限的页面。

#### Scenario: 访问详情页前验证
- **WHEN** 用户尝试访问详情页
- **THEN** 验证应用 ID 是否有效
- **AND** 如果无效则重定向到首页

### Requirement: 浏览器历史
前端应用 MUST 正确管理浏览器历史记录。

#### Scenario: 后退导航
- **WHEN** 用户点击浏览器后退按钮
- **THEN** 返回上一个页面
- **AND** 恢复页面状态

#### Scenario: 前进导航
- **WHEN** 用户点击浏览器前进按钮
- **THEN** 前进到下一个页面
- **AND** 恢复页面状态
