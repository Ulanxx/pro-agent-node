import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { Message } from '../../shared/types/message';

export enum UserIntent {
  INITIAL = 'INITIAL',
  REFINEMENT = 'REFINEMENT',
  IRRELEVANT = 'IRRELEVANT',
}

export enum TargetStage {
  ANALYSIS = 'ANALYSIS',
  COURSE_CONFIG = 'COURSE_CONFIG',
  VIDEO_OUTLINE = 'VIDEO_OUTLINE',
  SLIDE_SCRIPTS = 'SLIDE_SCRIPTS',
  THEME = 'THEME',
  SLIDES = 'SLIDES',
  NONE = 'NONE',
}

const IntentSchema = z.object({
  intent: z
    .nativeEnum(UserIntent)
    .describe('The classified intent of the user message'),
  targetStage: z
    .nativeEnum(TargetStage)
    .describe('The stage that needs refinement, if any'),
  reason: z.string().describe('Reasoning for this classification'),
});

type IntentResult = z.infer<typeof IntentSchema>;

@Injectable()
export class IntentClassifier {
  private readonly logger = new Logger(IntentClassifier.name);
  private model: { invoke: (p: any) => Promise<IntentResult> } | undefined;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASEURL;
    const modelName =
      process.env.OPENAI_MODEL || 'google/gemini-3-flash-preview';

    if (apiKey) {
      const baseModel = new ChatOpenAI({
        modelName: modelName,
        temperature: 0,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseURL,
          defaultHeaders: {
            'X-Title': 'Pro-Agent PPT Generator',
          },
        },
      });
      this.model = baseModel.withStructuredOutput(IntentSchema);
    }
  }

  async classify(message: string, history: Message[]): Promise<IntentResult> {
    if (!this.model) {
      this.logger.warn(
        'IntentClassifier model not initialized, defaulting to INITIAL',
      );
      return {
        intent: UserIntent.INITIAL,
        targetStage: TargetStage.NONE,
        reason: 'Model not initialized',
      };
    }

    // Only consider REFINEMENT if there's history and artifacts
    const hasHistory = history.length > 0;
    if (!hasHistory) {
      return {
        intent: UserIntent.INITIAL,
        targetStage: TargetStage.NONE,
        reason: 'No history found',
      };
    }

    const systemPrompt = `你是一个 PPT 生成系统的意图分类器。
系统包含以下 6 个阶段：
1. ANALYSIS: 需求分析
2. COURSE_CONFIG: 课程配置（目标受众、教学目标、预期页数等）
3. VIDEO_OUTLINE: 视频/PPT 大纲
4. SLIDE_SCRIPTS: 每页幻灯片的内容脚本
5. THEME: 视觉主题和风格
6. SLIDES: 最终 HTML 幻灯片生成

你的任务是判断用户的最新消息属于以下哪种意图：
1. INITIAL: 新的 PPT 生成请求
2. REFINEMENT: 对已有产物的修改意见
3. IRRELEVANT: 与 PPT 生成完全无关的内容（如问候、闲聊、询问其他问题等）

**重要规则：**
- 如果用户消息只是简单的问候（如"你好"、"嗨"等），没有任何 PPT 相关内容，必须归类为 IRRELEVANT
- 如果用户消息是闲聊、询问天气、时间等与 PPT 生成无关的内容，归类为 IRRELEVANT
- 如果用户消息包含任何 PPT 相关关键词或意图（如"做 PPT"、"幻灯片"、"演示文稿"、"课程"、"教学"等），归类为 INITIAL 或 REFINEMENT
- 如果是 REFINEMENT，请识别最适合开始优化的阶段。**如果修改意见涉及多个阶段，请始终选择最靠前（EARLIEST）的阶段，以确保级联更新能够保持内容的一致性。**

示例：
- "你好" -> IRRELEVANT
- "嗨" -> IRRELEVANT
- "今天天气怎么样" -> IRRELEVANT
- "帮我做一个关于 AI 的 PPT" -> INITIAL
- "给幻灯片增加更多图片" -> REFINEMENT (SLIDES)
- "大纲太复杂了，简化一下" -> REFINEMENT (VIDEO_OUTLINE)
- "将目标受众改为初学者" -> REFINEMENT (COURSE_CONFIG)
- "让风格看起来更专业" -> REFINEMENT (THEME)
- "我只想生成 4 页 PPT 并且主题是黑色" -> REFINEMENT (COURSE_CONFIG)（因为页数会影响整体结构规划）
`;

    const historyText = history
      .map((m) => `${m.role}: ${'content' in m ? m.content : '[Tool Message]'}`)
      .join('\n');

    const prompt = `${systemPrompt}\n\nSession History:\n${historyText}\n\nLatest User Message: ${message}`;

    try {
      const result = await this.model.invoke(prompt);
      this.logger.log(
        `Intent classification result: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error classifying intent: ${error}`);
      return {
        intent: UserIntent.INITIAL,
        targetStage: TargetStage.NONE,
        reason: `Error: ${error}`,
      };
    }
  }
}
