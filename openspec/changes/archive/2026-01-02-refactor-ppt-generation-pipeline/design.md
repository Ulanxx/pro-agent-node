# Design Document: 5 阶段 PPT 生成流程

## Context
当前系统使用 3 阶段流程（分析 → 规划 → 内容生成）生成 PPT，适用于通用演示文稿场景。但对于教学视频 PPT 生成，需要更细粒度的控制：课程配置、视频大纲、逐页脚本、主题风格和逐页渲染。

## Goals / Non-Goals

### Goals
- 将 PPT 生成流程重构为 5 个确定的、可追踪的阶段
- 每个阶段产生独立的、可验证的 Artifact
- 支持逐页生成和进度追踪
- 保持 DSL-First 架构原则

### Non-Goals
- 不改变底层的 WebSocket 通信协议
- 不修改前端渲染逻辑（仅扩展 Artifact 类型）
- 不引入新的外部依赖

## Decisions

### Decision 1: 5 阶段流程设计
**选择**: 采用线性 5 阶段流程
1. **课程配置生成** → `CourseConfig` Artifact
2. **讲解视频大纲** → `VideoOutline` Artifact  
3. **PPT 脚本生成** → `SlideScript[]` Artifact
4. **主题风格和母版** → `PresentationTheme` Artifact
5. **逐页 PPT 生成** → 循环生成 `SlidePage[]`，最终输出 `AnyGenDocument`

**理由**: 
- 每个阶段职责单一，便于调试和优化
- 中间产物可独立查看和编辑
- 支持未来的人工干预和审核流程

**替代方案**: 
- 保持 3 阶段流程，在内容生成阶段内部拆分 → 不利于进度追踪和错误定位
- 采用并行生成 → 增加复杂度，且教学 PPT 需要严格的逻辑顺序

### Decision 2: DSL 扩展策略
**选择**: 新增独立的 Schema，保持向后兼容
- `CourseConfigSchema`: 包含 `narrativeStyle`, `targetAudience`, `duration`, `objectives`
- `VideoOutlineSchema`: 包含 `theme`, `knowledgeUnits[]`, 每个单元包含 `knowledgePoints[]`
- `SlideScriptSchema`: 包含 `slideIndex`, `contentDesign`, `visualSuggestions`, `narrationScript`
- `PresentationThemeSchema`: 包含 `themeName`, `colorScheme`, `fontConfig`, `masterSlides`

**理由**:
- 符合 Zod Schema 的组合式设计
- 每个 Schema 可独立验证和序列化
- 便于未来扩展（如支持多语言、多风格）

### Decision 3: LLM 调用策略
**选择**: 每个阶段使用独立的 Prompt 和 `withStructuredOutput`
- 阶段 1-4: 单次 LLM 调用生成完整产物
- 阶段 5: 循环调用，每次生成一页 PPT

**理由**:
- 利用 Structured Output 保证输出格式正确性
- 逐页生成可实时推送进度，提升用户体验
- 减少单次 LLM 调用的 token 消耗和超时风险

**替代方案**:
- 一次性生成所有页面 → 可能超时，无法实时反馈进度
- 使用 Function Calling → 增加复杂度，且 Gemini 对 Structured Output 支持更好

### Decision 4: Artifact 管理
**选择**: 扩展 `ArtifactSchema` 的 `type` 枚举
```typescript
type: z.enum([
  'plan',
  'dsl',
  'pptx',
  'search_result',
  'web_page',
  'requirement_analysis',
  'course_config',        // 新增
  'video_outline',        // 新增
  'slide_scripts',        // 新增
  'presentation_theme',   // 新增
])
```

**理由**:
- 复用现有的 Artifact 存储和推送机制
- 前端可根据 `type` 渲染不同的可视化组件
- 保持与现有 `agent-interaction` spec 的一致性

## Risks / Trade-offs

### Risk 1: LLM 调用次数增加
- **风险**: 从 3 次增加到 5+ 次（逐页生成可能 10+ 次）
- **缓解**: 
  - 使用更快的模型（如 Gemini Flash）
  - 并行化非依赖阶段（如主题生成可与脚本生成并行）
  - 实现缓存机制，避免重复生成

### Risk 2: 中间产物存储开销
- **风险**: Redis 存储压力增加（每个 session 产生 5+ 个 Artifact）
- **缓解**:
  - 设置合理的 TTL（24 小时）
  - 压缩大型 Artifact（如 `slide_scripts`）
  - 实现分页加载机制

### Risk 3: 向后兼容性
- **风险**: 修改 `DocumentPlan` 可能影响现有代码
- **缓解**:
  - 保持 `DocumentPlan.tasks` 字段不变
  - 新增可选字段（如 `courseConfig?`, `videoOutline?`）
  - 编写迁移脚本和测试用例

## Migration Plan

### Phase 1: 扩展 DSL（不破坏现有功能）
1. 新增 Schema 定义
2. 更新 Artifact 类型枚举
3. 运行现有测试确保无回归

### Phase 2: 实现新流程（并行开发）
1. 创建新的 Prompt 模板
2. 实现新的 AgentService 方法
3. 在独立分支测试新流程

### Phase 3: 集成和切换
1. 在 ChatService 中添加流程选择逻辑（通过 feature flag）
2. 灰度发布，监控性能和错误率
3. 完全切换到新流程，移除旧代码

### Rollback Plan
- 保留旧的 3 阶段流程代码（标记为 deprecated）
- 通过环境变量快速切换回旧流程
- 监控关键指标（生成成功率、平均耗时）

## Open Questions
1. **是否需要支持用户在中间阶段干预？**（如编辑视频大纲后重新生成脚本）
   - 建议：第一版不支持，后续通过 `regenerate` 命令实现
2. **主题风格是否需要支持自定义上传？**（如企业 Logo、品牌色）
   - 建议：第一版使用预设主题，后续扩展
3. **逐页生成是否需要支持并行？**（如同时生成多页）
   - 建议：第一版串行，确保逻辑连贯性，后续优化
