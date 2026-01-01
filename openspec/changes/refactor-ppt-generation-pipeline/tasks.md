# Implementation Tasks

## 1. DSL 类型扩展
- [x] 1.1 在 `types.ts` 中新增 `CourseConfig` Schema（叙事风格、目标受众、时长等）
- [x] 1.2 新增 `VideoOutline` Schema（主题、知识单元、知识点层级结构）
- [x] 1.3 新增 `SlideScript` Schema（幻灯片内容设计、可视化建议、口播稿）
- [x] 1.4 新增 `PresentationTheme` Schema（主题风格、母版配置、颜色方案）
- [x] 1.5 修改 `DocumentPlan` 包含新的阶段产物引用（保持向后兼容）
- [x] 1.6 为所有新 Schema 编写 Zod 验证

## 2. Prompt 模板创建
- [x] 2.1 创建 `COURSE_CONFIG_PROMPT` 用于生成课程配置
- [x] 2.2 创建 `VIDEO_OUTLINE_PROMPT` 用于生成讲解视频大纲
- [x] 2.3 创建 `SLIDE_SCRIPT_PROMPT` 用于生成 PPT 脚本数组
- [x] 2.4 创建 `THEME_GENERATION_PROMPT` 用于生成主题风格和母版
- [x] 2.5 新增 `SLIDE_PAGE_GENERATION_PROMPT` 支持逐页生成

## 3. AgentService 流程重构
- [x] 3.1 新增 `generateCourseConfig()` 方法
- [x] 3.2 新增 `generateVideoOutline()` 方法
- [x] 3.3 新增 `generateSlideScripts()` 方法
- [x] 3.4 新增 `generatePresentationTheme()` 方法
- [x] 3.5 新增 `generateSlideByScript()` 方法支持单页生成
- [x] 3.6 保留原有 `generateDocument()` 方法以保持向后兼容

## 4. ChatService 工具调用更新
- [x] 4.1 创建 `Chat5StageService` 处理新的 5 阶段流程
- [x] 4.2 实现 `course_config` 工具消息处理
- [x] 4.3 实现 `video_outline` 工具消息处理
- [x] 4.4 实现 `slide_script` 工具消息处理
- [x] 4.5 实现 `theme_generation` 工具消息处理
- [x] 4.6 实现逐页生成的循环逻辑和进度推送

## 5. 渲染适配器增强
- [x] 5.1 在 `PptAdapter` 中支持 `PresentationTheme` 应用
- [x] 5.2 支持母版配置（通过主题背景色应用）
- [x] 5.3 支持全局颜色方案和字体配置

## 6. 测试和验证
- [ ] 6.1 编写单元测试覆盖新的 DSL Schema
- [ ] 6.2 编写集成测试验证 5 阶段流程
- [ ] 6.3 端到端测试验证完整的 PPT 生成
- [ ] 6.4 验证 WebSocket 事件推送的正确性
