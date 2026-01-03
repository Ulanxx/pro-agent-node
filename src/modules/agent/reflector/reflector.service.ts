import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import {
  Task,
  TaskList,
  QualityCheckResult,
  ReflectionResult,
} from '../../../core/dsl/task.types';

@Injectable()
export class ReflectorService {
  private readonly logger = new Logger(ReflectorService.name);
  private qualityModel:
    | { invoke: (p: any) => Promise<QualityCheckResult> }
    | undefined;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASEURL;
    const modelName =
      process.env.OPENAI_MODEL || 'google/gemini-3-flash-preview';

    if (apiKey) {
      const baseModel = new ChatOpenAI({
        modelName,
        temperature: 0.3,
        openAIApiKey: apiKey,
        configuration: {
          baseURL,
          defaultHeaders: {
            'X-Title': 'Pro-Agent PPT Generator',
          },
        },
      });

      this.qualityModel = baseModel.withStructuredOutput(
        z.object({
          isComplete: z.boolean(),
          meetsExpectations: z.boolean(),
          hasErrors: z.boolean(),
          issues: z.array(z.string()),
          score: z.number().min(0).max(100),
          needsRefinement: z.boolean(),
        }),
      );
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not found, reflection will use fallback logic',
      );
    }
  }

  /**
   * 反思执行结果，决定是否需要新任务
   */
  async reflect(
    taskList: TaskList,
    completedTask: Task,
    context: {
      sessionId: string;
      topic: string;
      artifacts: any[];
    },
  ): Promise<ReflectionResult> {
    this.logger.log(
      `Reflecting on task ${completedTask.id} of type ${completedTask.type}`,
    );

    // 1. 检查任务是否成功
    if (completedTask.status !== 'completed') {
      return {
        needsNewTasks: false,
        shouldContinue: false,
        reason: 'Task failed, stopping execution',
      };
    }

    // 2. 分析结果质量
    const qualityCheck = await this.checkResultQuality(completedTask, context);

    this.logger.log(
      `Quality check result: score=${qualityCheck.score}, needsRefinement=${qualityCheck.needsRefinement}`,
    );

    // 3. 判断是否需要优化任务
    if (qualityCheck.needsRefinement && qualityCheck.issues.length > 0) {
      return {
        needsNewTasks: true,
        newTaskSuggestions: [
          {
            type: 'refine_content' as any,
            description: `优化 ${completedTask.type} 的结果`,
            parameters: {
              taskId: completedTask.id,
              issues: qualityCheck.issues,
            },
            dependencies: [{ taskId: completedTask.id, condition: 'success' }],
            priority: 8,
            status: 'pending' as any,
            metadata: {
              estimatedDuration: 30,
              canRetry: true,
              maxRetries: 2,
            },
          },
        ],
        shouldContinue: true,
        reason: `Result quality needs improvement: ${qualityCheck.issues.join(', ')}`,
      };
    }

    // 4. 检查是否需要补充任务
    const additionalTasks = await this.suggestAdditionalTasks(
      completedTask,
      context,
    );

    if (additionalTasks.length > 0) {
      return {
        needsNewTasks: true,
        newTaskSuggestions: additionalTasks,
        shouldContinue: true,
        reason: 'Additional tasks needed based on current result',
      };
    }

    // 5. 检查是否所有任务完成
    const allCompleted = taskList.tasks.every(
      (t) => t.status === 'completed' || t.status === 'skipped',
    );

    if (allCompleted) {
      return {
        needsNewTasks: false,
        shouldContinue: false,
        reason: 'All tasks completed',
      };
    }

    // 6. 继续执行剩余任务
    return {
      needsNewTasks: false,
      shouldContinue: true,
      reason: 'Continue with remaining tasks',
    };
  }

  /**
   * 检查结果质量
   */
  private async checkResultQuality(
    task: Task,
    context: {
      sessionId: string;
      topic: string;
      artifacts: any[];
    },
  ): Promise<QualityCheckResult> {
    if (!this.qualityModel) {
      // Fallback: 假设结果质量良好
      return {
        isComplete: true,
        meetsExpectations: true,
        hasErrors: false,
        issues: [],
        score: 80,
        needsRefinement: false,
      };
    }

    try {
      const qualityPrompt = `评估以下任务结果的质量：

任务类型：${task.type}
任务描述：${task.description}
执行结果：${JSON.stringify(task.result)}

请评估：
1. 结果是否完整？
2. 结果是否符合预期？
3. 是否存在明显错误或遗漏？

返回 JSON 格式的评估结果。`;

      const evaluation = await this.qualityModel.invoke(qualityPrompt);
      this.logger.log(`Quality evaluation: ${JSON.stringify(evaluation)}`);

      return evaluation;
    } catch (error) {
      this.logger.error(`Error checking result quality: ${error}`);
      // Fallback: 假设结果质量良好
      return {
        isComplete: true,
        meetsExpectations: true,
        hasErrors: false,
        issues: [],
        score: 70,
        needsRefinement: false,
      };
    }
  }

  /**
   * 建议补充任务
   */
  private async suggestAdditionalTasks(
    completedTask: Task,
    context: {
      sessionId: string;
      topic: string;
      artifacts: any[];
    },
  ): Promise<Partial<Task>[]> {
    const suggestions: Partial<Task>[] = [];

    // 根据任务类型和结果，建议可能的后续任务
    switch (completedTask.type) {
      case 'generate_course_config': {
        const courseConfig = completedTask.result?.courseConfig;
        if (courseConfig?.targetAudience) {
          suggestions.push({
            type: 'search_web' as any,
            description: `搜索关于 "${courseConfig.targetAudience}" 的相关资料`,
            parameters: {
              query: `${courseConfig.targetAudience} 教学方法 最佳实践`,
            },
            dependencies: [{ taskId: completedTask.id, condition: 'success' }],
            priority: 5,
            status: 'pending' as any,
            metadata: {
              estimatedDuration: 20,
              canRetry: true,
              maxRetries: 3,
            },
          });
        }
        break;
      }

      case 'generate_video_outline': {
        const videoOutline = completedTask.result?.videoOutline;
        if (videoOutline?.knowledgeUnits?.length > 3) {
          suggestions.push({
            type: 'validate_result' as any,
            description: '验证视频大纲的复杂度是否合适',
            parameters: {
              taskId: completedTask.id,
              criteria: 'complexity',
            },
            dependencies: [{ taskId: completedTask.id, condition: 'success' }],
            priority: 3,
            status: 'pending' as any,
            metadata: {
              estimatedDuration: 15,
              canRetry: false,
              maxRetries: 1,
            },
          });
        }
        break;
      }

      case 'search_web': {
        const searchResults = completedTask.result?.searchResults;
        if (!searchResults || searchResults.length === 0) {
          suggestions.push({
            type: 'search_web' as any,
            description: '使用不同的关键词重新搜索',
            parameters: {
              query: `${context.topic} 相关信息`,
            },
            dependencies: [{ taskId: completedTask.id, condition: 'success' }],
            priority: 5,
            status: 'pending' as any,
            metadata: {
              estimatedDuration: 20,
              canRetry: true,
              maxRetries: 3,
            },
          });
        }
        break;
      }

      default:
        // 其他任务类型不需要补充任务
        break;
    }

    return suggestions;
  }
}
