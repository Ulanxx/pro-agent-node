## Context
AnyGenAgent 需要一个更健壮、可扩展的编排层来处理日益复杂的 PPT 生成任务。当前的线性流限制了“用户反馈循环”和“动态流程跳转”的实现。

## Goals / Non-Goals
- **Goals**:
    - 将线性生成流转化为基于 LangGraph 的有向图。
    - 实现节点级别的状态自动持久化。
    - 提供清晰的图执行路径，支持中断和恢复。
- **Non-Goals**:
    - 不改变现有的 LLM Prompt 逻辑（由 `AgentService` 维护）。
    - 不改变现有的 DSL 定义。

## Decisions
- **Decision: 使用 StateGraph 编排**
    - 理由：这是 LangGraph 处理循环和复杂状态的标准方式。
- **Decision: 节点逻辑复用 AgentService**
    - 理由：减少迁移工作量，保持职责分离（Service 负责 LLM 调用，Graph 负责流程编排）。
- **Decision: 统一 Prompt 配置文件**
    - 理由：将 Prompt 从 Service 代码中分离，使用集中式的配置文件或对象管理，提高可维护性。
- **Decision: 初始使用 MemorySaver 作为 Checkpointer**
    - 理由：简化初期实现，后期可平滑切换到 Redis 实现以支持多实例分布式状态。

## 设计细节

### AgentState 定义
```typescript
const AgentState = Annotation.Root({
  sessionId: Annotation<string>(),
  topic: Annotation<string>(),
  chatMessageId: Annotation<string>(),
  
  // 阶段产物 (DSL 对象)
  analysis: Annotation<string>(),
  courseConfig: Annotation<CourseConfig>(),
  videoOutline: Annotation<VideoOutline>(),
  slideScripts: Annotation<SlideScript[]>(),
  theme: Annotation<PresentationTheme>(),
  document: Annotation<PptHtmlDocument>(),
  
  // 运行元数据
  currentStage: Annotation<TargetStage>(),
  error: Annotation<string>(),
});
```

### Prompt 配置结构
```typescript
// 建议结构
export const AGENT_PROMPTS = {
  [TargetStage.ANALYSIS]: {
    template: ANALYSIS_PROMPT_TEMPLATE,
    inputVariables: ["topic"],
    // ...
  },
  // ... 其他阶段
}
```

### 节点拓扑
1. `START` -> `analysis`
2. `analysis` -> `courseConfig`
3. `courseConfig` -> `videoOutline`
4. `videoOutline` -> `slideScripts`
5. `slideScripts` -> `theme`
6. `theme` -> `slides`
7. `slides` -> `END`

*未来扩展：在 `courseConfig` 节点后增加判断逻辑，如果检测到用户反馈，则跳转回 `analysis`。*

## Risks / Trade-offs
- **学习曲线**：团队需要理解 LangGraph 的 Graph 概念。
- **迁移期双活**：旧的 `Chat5StageService` 可能需要保留一段时间作为回退或对照。

## Migration Plan
1. 安装依赖。
2. 创建 `graph` 模块和基础 `AgentState`。
3. 重构 Prompt 维护结构，将 Prompt 抽取到独立配置中。
4. 实现各个 Node（封装 `AgentService` 调用）。
5. 重写 `Chat5StageService`，全面切换到 Graph 执行。
6. 验证通过后，彻底清理旧的过程式代码。
