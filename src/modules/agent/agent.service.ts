/**
 * Agent 服务
 *
 * 该服务是 Pro-Agent 项目的核心服务，负责协调 PPT 生成的各个阶段。
 *
 * 主要功能：
 * - 分析用户需求
 * - 生成课程配置
 * - 生成视频大纲
 * - 生成 PPT 脚本
 * - 生成主题风格
 * - 生成幻灯片 HTML
 * - 执行网络搜索
 *
 * 该服务使用 OpenAI API（或兼容的 API）来生成内容，并将结果保存到数据库和存储服务。
 *
 * 环境变量：
 * - OPENAI_API_KEY: OpenAI API 密钥
 * - OPENAI_BASEURL: OpenAI API 基础 URL（用于兼容其他 API）
 * - OPENAI_MODEL: 使用的模型名称，默认为 google/gemini-3-flash-preview
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { AGENT_PROMPTS } from './prompts/config';
import { TargetStage } from './intent-classifier.service';
import {
  CourseConfig,
  CourseConfigSchema,
  VideoOutline,
  VideoOutlineSchema,
  SlideScript,
  SlideScriptSchema,
  PresentationTheme,
  PresentationThemeSchema,
  SlideHtml,
  SlideHtmlSchema,
} from '../../core/dsl/types';
import { WebSearchTool, SearchResult } from './tools/web-search.tool';
import { ApplicationService } from '../application/application.service';
import { ArtifactService } from '../application/artifact.service';
import { ApplicationStatus } from '../database/entities/application.entity';
import { ArtifactType } from '../database/entities/artifact.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * 状态更新回调函数类型
 * 用于在 PPT 生成过程中更新进度状态
 */
type StatusUpdateCallback = (
  status:
    | 'analyzing'
    | 'planning'
    | 'generating'
    | 'reviewing'
    | 'course_config'
    | 'video_outline'
    | 'slide_script'
    | 'theme_generation'
    | 'generating_slide',
  progress: number, // 进度百分比（0-100）
  message: string, // 状态消息
  data?: any, // 附加数据
) => Promise<void> | void;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  // AI 模型实例
  private analysisModel: ChatOpenAI | undefined; // 需求分析模型
  private courseConfigModel:
    | { invoke: (p: any) => Promise<CourseConfig> }
    | undefined; // 课程配置生成模型
  private videoOutlineModel:
    | { invoke: (p: any) => Promise<VideoOutline> }
    | undefined; // 视频大纲生成模型
  private slideScriptModel:
    | { invoke: (p: any) => Promise<SlideScript[]> }
    | undefined; // PPT 脚本生成模型
  private themeModel:
    | { invoke: (p: any) => Promise<PresentationTheme> }
    | undefined; // 主题生成模型
  private slidePageModel:
    | { invoke: (p: any) => Promise<SlideHtml> }
    | undefined; // 幻灯片生成模型

  /**
   * 构造函数
   * 初始化 AI 模型实例
   */
  constructor(
    private readonly webSearchTool: WebSearchTool,
    private readonly applicationService: ApplicationService,
    private readonly artifactService: ArtifactService,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASEURL;
    const modelName =
      process.env.OPENAI_MODEL || 'google/gemini-3-flash-preview';

    // 如果配置了 API 密钥，则初始化 AI 模型
    if (apiKey) {
      const baseModel = new ChatOpenAI({
        modelName: modelName,
        temperature: 0.7, // 温度参数，控制输出的随机性
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseURL,
          defaultHeaders: {
            'X-Title': 'Pro-Agent PPT Generator',
          },
        },
      });

      // 为不同的生成任务创建结构化输出模型
      this.analysisModel = baseModel;
      this.courseConfigModel =
        baseModel.withStructuredOutput(CourseConfigSchema);
      this.videoOutlineModel =
        baseModel.withStructuredOutput(VideoOutlineSchema);
      this.slideScriptModel = baseModel.withStructuredOutput(
        z.array(SlideScriptSchema),
      );
      this.themeModel = baseModel.withStructuredOutput(PresentationThemeSchema);
      this.slidePageModel = baseModel.withStructuredOutput(SlideHtmlSchema);
    } else {
      this.logger.warn('OPENAI_API_KEY not found, using MockLLMService logic.');
    }
  }

  async analyzeTopic(
    topic: string,
    onStatusUpdate?: StatusUpdateCallback,
    applicationId?: string,
  ): Promise<string> {
    await onStatusUpdate?.('analyzing', 5, '正在深入解析需求...');

    if (!this.analysisModel) {
      throw new Error('Analysis model not initialized');
    }

    try {
      const prompt = await AGENT_PROMPTS[TargetStage.ANALYSIS].prompt.format({
        topic,
      });
      const result = await this.analysisModel.invoke(prompt);
      const content =
        typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);

      this.logger.log(`Requirement Analysis Completed: ${content}`);

      // 保存 artifact
      if (applicationId) {
        await this.saveArtifact(
          applicationId,
          ArtifactType.REQUIREMENT_ANALYSIS,
          '需求分析',
          { topic, analysis: content },
        );
        await this.updateApplicationProgress(
          applicationId,
          ApplicationStatus.PROCESSING,
          5,
          '需求分析完成',
        );
      }

      return content;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in analysis stage: ${errorMessage}`);
      throw error;
    }
  }

  async generateCourseConfig(
    topic: string,
    analysisContent: string,
    onStatusUpdate?: StatusUpdateCallback,
    refinementPrompt?: string,
    applicationId?: string,
  ): Promise<CourseConfig> {
    await onStatusUpdate?.('course_config', 10, '正在生成课程配置...');

    if (!this.courseConfigModel) {
      throw new Error('Course config model not initialized');
    }

    try {
      const prompt = await AGENT_PROMPTS[
        TargetStage.COURSE_CONFIG
      ].prompt.format({
        topic,
        analysis: analysisContent,
        refinementPrompt: refinementPrompt || 'None',
      });
      const result = await this.courseConfigModel.invoke(prompt);
      this.logger.log(`Course config generated: ${JSON.stringify(result)}`);

      // 保存 artifact
      if (applicationId) {
        await this.saveArtifact(
          applicationId,
          ArtifactType.COURSE_CONFIG,
          '课程配置',
          result,
        );
        await this.updateApplicationProgress(
          applicationId,
          ApplicationStatus.PROCESSING,
          10,
          '课程配置生成完成',
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in course config generation: ${errorMessage}`);
      throw error;
    }
  }

  async generateVideoOutline(
    courseConfig: CourseConfig,
    onStatusUpdate?: StatusUpdateCallback,
    refinementPrompt?: string,
    applicationId?: string,
  ): Promise<VideoOutline> {
    await onStatusUpdate?.('video_outline', 25, '正在生成视频大纲...');

    if (!this.videoOutlineModel) {
      throw new Error('Video outline model not initialized');
    }

    try {
      const prompt = await AGENT_PROMPTS[
        TargetStage.VIDEO_OUTLINE
      ].prompt.format({
        courseConfig: JSON.stringify(courseConfig),
        refinementPrompt: refinementPrompt || 'None',
      });
      const result = await this.videoOutlineModel.invoke(prompt);
      this.logger.log(`Video outline generated: ${JSON.stringify(result)}`);

      // 保存 artifact
      if (applicationId) {
        await this.saveArtifact(
          applicationId,
          ArtifactType.VIDEO_OUTLINE,
          '视频大纲',
          result,
        );
        await this.updateApplicationProgress(
          applicationId,
          ApplicationStatus.PROCESSING,
          25,
          '视频大纲生成完成',
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in video outline generation: ${errorMessage}`);
      throw error;
    }
  }

  async generateSlideScripts(
    videoOutline: VideoOutline,
    courseConfig: CourseConfig,
    onStatusUpdate?: StatusUpdateCallback,
    refinementPrompt?: string,
    applicationId?: string,
  ): Promise<SlideScript[]> {
    await onStatusUpdate?.('slide_script', 40, '正在生成 PPT 脚本...');

    if (!this.slideScriptModel) {
      throw new Error('Slide script model not initialized');
    }

    try {
      const prompt = await AGENT_PROMPTS[
        TargetStage.SLIDE_SCRIPTS
      ].prompt.format({
        videoOutline: JSON.stringify(videoOutline),
        courseConfig: JSON.stringify(courseConfig),
        refinementPrompt: refinementPrompt || 'None',
      });
      const result = await this.slideScriptModel.invoke(prompt);
      this.logger.log(`Slide scripts generated: ${result.length} slides`);

      // 保存 artifact
      if (applicationId) {
        await this.saveArtifact(
          applicationId,
          ArtifactType.SLIDE_SCRIPTS,
          'PPT 脚本',
          result,
        );
        await this.updateApplicationProgress(
          applicationId,
          ApplicationStatus.PROCESSING,
          40,
          'PPT 脚本生成完成',
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in slide script generation: ${errorMessage}`);
      throw error;
    }
  }

  async generatePresentationTheme(
    courseConfig: CourseConfig,
    videoOutline: VideoOutline,
    onStatusUpdate?: StatusUpdateCallback,
    refinementPrompt?: string,
    applicationId?: string,
  ): Promise<PresentationTheme> {
    await onStatusUpdate?.('theme_generation', 55, '正在生成主题风格...');

    if (!this.themeModel) {
      throw new Error('Theme model not initialized');
    }

    try {
      const prompt = await AGENT_PROMPTS[TargetStage.THEME].prompt.format({
        courseConfig: JSON.stringify(courseConfig),
        videoOutline: JSON.stringify(videoOutline),
        refinementPrompt: refinementPrompt || 'None',
      });
      const result = await this.themeModel.invoke(prompt);
      this.logger.log(
        `Presentation theme generated: ${JSON.stringify(result)}`,
      );

      // 保存 artifact
      if (applicationId) {
        await this.saveArtifact(
          applicationId,
          ArtifactType.PRESENTATION_THEME,
          '主题风格',
          result,
        );
        await this.updateApplicationProgress(
          applicationId,
          ApplicationStatus.PROCESSING,
          55,
          '主题风格生成完成',
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in theme generation: ${errorMessage}`);
      throw error;
    }
  }

  async generateSlideByScript(
    slideScript: SlideScript,
    theme: PresentationTheme,
    courseTitle: string,
    expectedPageCount: number,
    onStatusUpdate?: StatusUpdateCallback,
    refinementPrompt?: string,
    applicationId?: string,
  ): Promise<SlideHtml> {
    const progress = 60 + (slideScript.slideIndex / expectedPageCount) * 35;
    await onStatusUpdate?.(
      'generating_slide',
      progress,
      `正在生成第 ${slideScript.slideIndex + 1} 页 / 共 ${expectedPageCount} 页...`,
    );

    if (!this.slidePageModel) {
      throw new Error('Slide page model not initialized');
    }

    try {
      const prompt = await AGENT_PROMPTS[TargetStage.SLIDES].prompt.format({
        slideIndex: slideScript.slideIndex,
        type: slideScript.type,
        title: slideScript.title,
        content: Array.isArray(slideScript.content)
          ? slideScript.content.join('; ')
          : slideScript.content,
        visualSuggestions: slideScript.visualSuggestions,
        designStyle: theme.themeName, // 或者从 theme 中获取更详细的描述
        primaryColor: theme.colorScheme.primary,
        secondaryColor: theme.colorScheme.secondary,
        backgroundColor: theme.colorScheme.background,
        textColor: theme.colorScheme.text,
        courseTitle: courseTitle,
        refinementPrompt: refinementPrompt || 'None',
      });
      const result = await this.slidePageModel.invoke(prompt);
      this.logger.log(`Slide page ${slideScript.slideIndex} generated`);

      // 保存 artifact
      if (applicationId) {
        await this.saveArtifact(
          applicationId,
          ArtifactType.PPT_HTML,
          `幻灯片 ${slideScript.slideIndex + 1}: ${slideScript.title}`,
          result,
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in slide page generation: ${errorMessage}`);
      throw error;
    }
  }

  async performSearch(
    query: string,
    onToolArtifact?: (
      artifactId: string,
      type: 'search_result' | 'web_page',
      content: { query: string; results: SearchResult[] },
    ) => void,
  ): Promise<SearchResult[]> {
    const artifactId = `art_search_${uuidv4()}`;
    const results = await this.webSearchTool.search(query);

    if (onToolArtifact) {
      onToolArtifact(artifactId, 'search_result', {
        query,
        results,
      });
    }

    return results;
  }

  /**
   * 保存 artifact 到 MySQL 和 Bunny Storage
   */
  private async saveArtifact(
    applicationId: string,
    type: ArtifactType,
    title: string,
    content: any,
  ): Promise<void> {
    try {
      await this.artifactService.create(
        applicationId,
        type,
        content,
        undefined, // file buffer (optional)
        title,
      );
      this.logger.log(
        `Artifact saved: ${type} for application ${applicationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save artifact: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 更新应用状态和进度
   */
  private async updateApplicationProgress(
    applicationId: string,
    status: ApplicationStatus,
    progress: number,
    message?: string,
  ): Promise<void> {
    try {
      await this.applicationService.updateStatus(applicationId, {
        status,
      });
      // TODO: 也可以通过 Socket 推送进度更新
      this.logger.log(
        `Application ${applicationId} status updated to ${status}, progress: ${progress}%${message ? `, message: ${message}` : ''}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update application status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
