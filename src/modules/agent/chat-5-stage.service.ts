import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SocketGateway } from '../socket/socket.gateway';
import { AgentService } from './agent.service';
import { ArtifactService } from './artifact.service';
import { ChatService } from './chat.service';
import { Redis } from 'ioredis';
import {
  Artifact,
  CourseConfig,
  VideoOutline,
  SlideScript,
  PresentationTheme,
  SlideHtml,
  PptHtmlDocument,
} from '../../core/dsl/types';
import { TargetStage } from './intent-classifier.service';

@Injectable()
export class Chat5StageService {
  private readonly logger = new Logger(Chat5StageService.name);
  private readonly redis: Redis;

  constructor(
    private readonly socketGateway: SocketGateway,
    private readonly agentService: AgentService,
    private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async handle5StagePPTGeneration(
    sessionId: string,
    message: string,
    chatMessageId: string,
    entryStage: TargetStage = TargetStage.ANALYSIS,
  ): Promise<PptHtmlDocument> {
    try {
      let analysisContent: string = '';
      let courseConfig: CourseConfig | null = null;
      let videoOutline: VideoOutline | null = null;
      let slideScripts: SlideScript[] = [];
      let theme: PresentationTheme | null = null;

      // Stage 1: Analysis
      if (entryStage === TargetStage.ANALYSIS || !entryStage) {
        analysisContent = await this.stageAnalysis(
          sessionId,
          message,
          chatMessageId,
        );
      } else {
        const artifact = await this.artifactService.getLatestArtifactByType(
          sessionId,
          'requirement_analysis',
        );
        analysisContent = (artifact?.content as string) || '';
      }

      // Stage 2: Course Config
      if (
        entryStage === TargetStage.COURSE_CONFIG ||
        (!courseConfig && entryStage === TargetStage.ANALYSIS) ||
        !entryStage
      ) {
        courseConfig = await this.stageCourseConfig(
          sessionId,
          message,
          analysisContent,
          chatMessageId,
          entryStage === TargetStage.COURSE_CONFIG ? message : undefined,
        );
      } else {
        const artifact = await this.artifactService.getLatestArtifactByType(
          sessionId,
          'course_config',
        );
        courseConfig = artifact?.content as CourseConfig;
      }

      // Stage 3: Video Outline
      if (
        entryStage === TargetStage.VIDEO_OUTLINE ||
        (!videoOutline &&
          [TargetStage.ANALYSIS, TargetStage.COURSE_CONFIG].includes(
            entryStage,
          )) ||
        !entryStage
      ) {
        if (!courseConfig) {
          throw new Error('Course config is required for video outline');
        }
        videoOutline = await this.stageVideoOutline(
          sessionId,
          courseConfig,
          chatMessageId,
          entryStage === TargetStage.VIDEO_OUTLINE ? message : undefined,
        );
      } else {
        const artifact = await this.artifactService.getLatestArtifactByType(
          sessionId,
          'video_outline',
        );
        videoOutline = artifact?.content as VideoOutline;
      }

      // Stage 4: Slide Scripts
      if (
        entryStage === TargetStage.SLIDE_SCRIPTS ||
        (!slideScripts.length &&
          [
            TargetStage.ANALYSIS,
            TargetStage.COURSE_CONFIG,
            TargetStage.VIDEO_OUTLINE,
          ].includes(entryStage)) ||
        !entryStage
      ) {
        if (!videoOutline || !courseConfig) {
          throw new Error(
            'Video outline and course config are required for slide scripts',
          );
        }
        slideScripts = await this.stageSlideScripts(
          sessionId,
          videoOutline,
          courseConfig,
          chatMessageId,
          entryStage === TargetStage.SLIDE_SCRIPTS ? message : undefined,
        );
      } else {
        const artifact = await this.artifactService.getLatestArtifactByType(
          sessionId,
          'slide_scripts',
        );
        slideScripts = (artifact?.content as SlideScript[]) || [];
      }

      // Stage 5: Theme
      if (
        entryStage === TargetStage.THEME ||
        (!theme &&
          [
            TargetStage.ANALYSIS,
            TargetStage.COURSE_CONFIG,
            TargetStage.VIDEO_OUTLINE,
            TargetStage.SLIDE_SCRIPTS,
          ].includes(entryStage)) ||
        !entryStage
      ) {
        if (!courseConfig || !videoOutline) {
          throw new Error(
            'Course config and video outline are required for theme',
          );
        }
        theme = await this.stagePresentationTheme(
          sessionId,
          courseConfig,
          videoOutline,
          chatMessageId,
          entryStage === TargetStage.THEME ? message : undefined,
        );
      } else {
        const artifact = await this.artifactService.getLatestArtifactByType(
          sessionId,
          'presentation_theme',
        );
        theme = artifact?.content as PresentationTheme;
      }

      // Stage 6: Slides
      if (!theme || !courseConfig || !videoOutline) {
        throw new Error(
          'Theme, course config, and video outline are required for slides',
        );
      }
      const document = await this.stageSlideGeneration(
        sessionId,
        slideScripts,
        theme,
        courseConfig,
        videoOutline.theme,
        chatMessageId,
        entryStage === TargetStage.SLIDES ? message : undefined,
      );

      this.socketGateway.emitCompletion(sessionId, {
        success: true,
        finalArtifactId: `art_dsl_${Date.now()}`,
      });

      return document;
    } catch (error) {
      this.logger.error(`5-stage PPT generation failed: ${error}`);
      this.socketGateway.emitCompletion(sessionId, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async stageAnalysis(
    sessionId: string,
    message: string,
    parentMessageId: string,
  ): Promise<string> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_analysis_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'analyze_topic',
      title: '需求分析',
      content: '',
      progressText: '正在分析需求...',
      parentMessageId,
      timestamp: Date.now(),
    });

    await this.chatService.saveMessage(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'analyze_topic',
      title: '需求分析',
      content: '',
      progressText: '正在分析需求...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const analysisContent = await this.agentService.analyzeTopic(
      message,
      () => {
        // 阶段 1-5 不发送 progress 事件，由 tool:update 驱动
      },
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'requirement_analysis',
      content: analysisContent,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(sessionId, artifact);
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: toolMessageId,
      showInCanvas: true,
      artifact,
    });

    this.socketGateway.emitToolUpdate(sessionId, {
      id: toolMessageId,
      status: 'completed',
      artifactIds: [artifactId],
    });

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return analysisContent;
  }

  private async stageCourseConfig(
    sessionId: string,
    topic: string,
    analysisContent: string,
    parentMessageId: string,
    refinementPrompt?: string,
  ): Promise<CourseConfig> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_course_config_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_course_config',
      title: refinementPrompt ? '课程配置优化' : '课程配置生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化课程配置...'
        : '正在生成课程配置...',
      parentMessageId,
      timestamp: Date.now(),
    });

    await this.chatService.saveMessage(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_course_config',
      title: refinementPrompt ? '课程配置优化' : '课程配置生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化课程配置...'
        : '正在生成课程配置...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const courseConfig = await this.agentService.generateCourseConfig(
      topic,
      analysisContent,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'course_config',
      content: courseConfig,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(sessionId, artifact);
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: toolMessageId,
      showInCanvas: true,
      artifact,
    });

    this.socketGateway.emitToolUpdate(sessionId, {
      id: toolMessageId,
      status: 'completed',
      artifactIds: [artifactId],
    });

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return courseConfig;
  }

  private async stageVideoOutline(
    sessionId: string,
    courseConfig: CourseConfig,
    parentMessageId: string,
    refinementPrompt?: string,
  ): Promise<VideoOutline> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_video_outline_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_video_outline',
      title: refinementPrompt ? '视频大纲优化' : '视频大纲生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化视频大纲...'
        : '正在生成视频大纲...',
      parentMessageId,
      timestamp: Date.now(),
    });

    await this.chatService.saveMessage(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_video_outline',
      title: refinementPrompt ? '视频大纲优化' : '视频大纲生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化视频大纲...'
        : '正在生成视频大纲...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const videoOutline = await this.agentService.generateVideoOutline(
      courseConfig,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'video_outline',
      content: videoOutline,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(sessionId, artifact);
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: toolMessageId,
      showInCanvas: true,
      artifact,
    });

    this.socketGateway.emitToolUpdate(sessionId, {
      id: toolMessageId,
      status: 'completed',
      artifactIds: [artifactId],
    });

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return videoOutline;
  }

  private async stageSlideScripts(
    sessionId: string,
    videoOutline: VideoOutline,
    courseConfig: CourseConfig,
    parentMessageId: string,
    refinementPrompt?: string,
  ): Promise<SlideScript[]> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_slide_scripts_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_slide_scripts',
      title: refinementPrompt ? 'PPT 脚本优化' : 'PPT 脚本生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化 PPT 脚本...'
        : '正在生成 PPT 脚本...',
      parentMessageId,
      timestamp: Date.now(),
    });

    await this.chatService.saveMessage(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_slide_scripts',
      title: refinementPrompt ? 'PPT 脚本优化' : 'PPT 脚本生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化 PPT 脚本...'
        : '正在生成 PPT 脚本...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const slideScripts = await this.agentService.generateSlideScripts(
      videoOutline,
      courseConfig,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'slide_scripts',
      content: slideScripts,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(sessionId, artifact);
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: toolMessageId,
      showInCanvas: true,
      artifact,
    });

    this.socketGateway.emitToolUpdate(sessionId, {
      id: toolMessageId,
      status: 'completed',
      artifactIds: [artifactId],
    });

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return slideScripts;
  }

  private async stagePresentationTheme(
    sessionId: string,
    courseConfig: CourseConfig,
    videoOutline: VideoOutline,
    parentMessageId: string,
    refinementPrompt?: string,
  ): Promise<PresentationTheme> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_theme_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_presentation_theme',
      title: refinementPrompt ? '主题风格优化' : '主题风格生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化主题风格...'
        : '正在生成主题风格...',
      parentMessageId,
      timestamp: Date.now(),
    });

    await this.chatService.saveMessage(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_presentation_theme',
      title: refinementPrompt ? '主题风格优化' : '主题风格生成',
      content: '',
      progressText: refinementPrompt
        ? '正在优化主题风格...'
        : '正在生成主题风格...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const theme = await this.agentService.generatePresentationTheme(
      courseConfig,
      videoOutline,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'presentation_theme',
      content: theme,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(sessionId, artifact);
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: toolMessageId,
      showInCanvas: true,
      artifact,
    });

    this.socketGateway.emitToolUpdate(sessionId, {
      id: toolMessageId,
      status: 'completed',
      artifactIds: [artifactId],
    });

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return theme;
  }

  private async stageSlideGeneration(
    sessionId: string,
    slideScripts: SlideScript[],
    theme: PresentationTheme,
    courseConfig: CourseConfig,
    courseTitle: string,
    chatMessageId: string,
    refinementPrompt?: string,
  ): Promise<PptHtmlDocument> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_ppt_html_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_slides',
      title: refinementPrompt ? '逐页优化 PPT HTML' : '逐页生成 PPT HTML',
      content: '',
      progressText: refinementPrompt
        ? '正在逐页优化 PPT HTML...'
        : '正在逐页生成 PPT HTML...',
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    await this.chatService.saveMessage(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_slides',
      title: refinementPrompt ? '逐页优化 PPT HTML' : '逐页生成 PPT HTML',
      content: '',
      progressText: refinementPrompt
        ? '正在逐页优化 PPT HTML...'
        : '正在逐页生成 PPT HTML...',
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    const pages: SlideHtml[] = [];
    for (const script of slideScripts) {
      const page = await this.agentService.generateSlideByScript(
        script,
        theme,
        courseTitle,
        courseConfig.expectedPageCount,
        (status, progress, msg) => {
          this.socketGateway.emitProgress(sessionId, {
            status,
            progress,
            message: msg,
            artifactId,
          });
        },
        refinementPrompt,
      );
      pages.push(page);
    }

    const document: PptHtmlDocument = {
      title:
        courseConfig.targetAudience +
        ' - ' +
        (slideScripts[0]?.contentDesign || '演示文稿'),
      pages,
    };

    const artifact: Artifact = {
      id: artifactId,
      type: 'ppt_html_doc',
      content: document,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(sessionId, artifact);
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: toolMessageId,
      showInCanvas: true,
      artifact,
    });

    this.socketGateway.emitToolUpdate(sessionId, {
      id: toolMessageId,
      status: 'completed',
      artifactIds: [artifactId],
    });

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return document;
  }
}
