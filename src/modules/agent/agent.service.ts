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
  progress: number,
  message: string,
  data?: any,
) => Promise<void> | void;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private analysisModel: ChatOpenAI | undefined;
  private courseConfigModel:
    | { invoke: (p: any) => Promise<CourseConfig> }
    | undefined;
  private videoOutlineModel:
    | { invoke: (p: any) => Promise<VideoOutline> }
    | undefined;
  private slideScriptModel:
    | { invoke: (p: any) => Promise<SlideScript[]> }
    | undefined;
  private themeModel:
    | { invoke: (p: any) => Promise<PresentationTheme> }
    | undefined;
  private slidePageModel:
    | { invoke: (p: any) => Promise<SlideHtml> }
    | undefined;

  constructor(private readonly webSearchTool: WebSearchTool) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASEURL;
    const modelName =
      process.env.OPENAI_MODEL || 'google/gemini-3-flash-preview';

    if (apiKey) {
      const baseModel = new ChatOpenAI({
        modelName: modelName,
        temperature: 0.7,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseURL,
        },
      });
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
    const artifactId = `art_search_${Date.now()}`;
    const results = await this.webSearchTool.search(query);

    if (onToolArtifact) {
      onToolArtifact(artifactId, 'search_result', {
        query,
        results,
      });
    }

    return results;
  }
}
