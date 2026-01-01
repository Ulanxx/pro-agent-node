import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * 任务规划 Prompt
 * 用于根据用户需求生成任务列表
 */
export const TASK_PLANNING_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个专业的任务规划专家。
你的目标是为 PPT 生成系统创建一个详细的任务列表。

核心规则：
1. 输出必须严格遵守 TaskListSchema 模式。
2. 任务类型：从以下类型中选择合适的任务：
   - analyze_topic: 需求分析
   - generate_course_config: 课程配置生成
   - generate_video_outline: 视频/PPT 大纲生成
   - generate_slide_scripts: PPT 脚本生成
   - generate_theme: 主题风格生成
   - generate_slides: 逐页 PPT HTML 生成
   - search_web: 网络搜索
   - refine_content: 内容优化
   - validate_result: 结果验证

3. 任务依赖：
   - analyze_topic 是第一个任务，没有依赖
   - generate_course_config 依赖 analyze_topic
   - generate_video_outline 依赖 generate_course_config
   - generate_slide_scripts 依赖 generate_video_outline
   - generate_theme 依赖 generate_video_outline
   - generate_slides 依赖 generate_slide_scripts 和 generate_theme
   - search_web 可以在任何阶段插入，用于获取外部信息
   - refine_content 依赖要优化的任务
   - validate_result 依赖要验证的任务

4. 优先级：
   - 核心流程任务（analyze_topic, generate_course_config 等）：优先级 10
   - 辅助任务（search_web）：优先级 5
   - 优化任务（refine_content）：优先级 8
   - 验证任务（validate_result）：优先级 3

5. 任务描述：清晰、简洁地描述任务目标。

6. 参数：为每个任务提供必要的参数。

7. 元数据：为每个任务设置合理的元数据：
   - estimatedDuration: 预计执行时间（秒）
   - canRetry: 是否可以重试（默认 true）
   - maxRetries: 最大重试次数（默认 3）

8. 任务数量：通常生成 5-8 个任务，覆盖完整的 PPT 生成流程。

9. 灵活性：根据用户需求动态调整任务列表。例如：
   - 如果用户提供了具体页数要求，在 generate_course_config 中体现
   - 如果用户需要特定风格，可能需要额外的 search_web 任务
   - 如果用户提供了参考文档，需要 analyze_document 任务

10. 状态：所有任务的初始状态必须是 'pending'。`,
  ],
  [
    'user',
    `请为以下 PPT 生成需求创建任务列表：

用户需求：{topic}

历史消息（如果有）：{history}

已有 artifacts（如果有）：{existingArtifacts}

优化提示（如果有）：{refinementPrompt}

请生成一个完整的任务列表，包含所有必要的任务、依赖关系和优先级。`,
  ],
]);

/**
 * 动态任务生成 Prompt
 * 用于在执行过程中动态添加新任务
 */
export const DYNAMIC_TASK_GENERATION_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个专业的任务规划专家。
你的目标是在任务执行过程中，根据当前情况动态生成新的任务。

核心规则：
1. 输出必须严格遵守 TaskSchema 模式。
2. 任务类型：从以下类型中选择合适的任务。
3. 依赖：新任务必须正确引用已存在的任务 ID。
4. 优先级：根据任务的紧急性和重要性设置合理的优先级。
5. 原因：清楚说明为什么需要这个新任务。

常见场景：
- 如果搜索结果不够充分，添加新的 search_web 任务
- 如果生成的内容质量不高，添加 refine_content 任务
- 如果发现需要验证某个结果，添加 validate_result 任务
- 如果需要补充信息，添加相应的生成任务`,
  ],
  [
    'user',
    `当前任务列表：{taskList}

刚刚完成的任务：{completedTask}

执行结果：{executionResult}

需要新任务的原因：{reason}

请生成必要的新任务。`,
  ],
]);

/**
 * 任务优化 Prompt
 * 用于优化现有任务
 */
export const TASK_REFINEMENT_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个专业的任务优化专家。
你的目标是根据用户反馈优化现有任务。

核心规则：
1. 输出必须严格遵守 TaskSchema 模式。
2. 保持任务 ID 不变。
3. 根据用户反馈调整任务参数。
4. 如果需要，可以调整任务优先级。
5. 保持依赖关系不变，除非用户明确要求改变执行顺序。`,
  ],
  [
    'user',
    `原任务：{task}

用户反馈：{feedback}

请根据用户反馈优化这个任务。`,
  ],
]);
