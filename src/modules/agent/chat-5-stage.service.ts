import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SocketGateway } from '../socket/socket.gateway';
import { AgentService } from './agent.service';
import { ArtifactService } from './artifact.service';
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

@Injectable()
export class Chat5StageService {
  private readonly logger = new Logger(Chat5StageService.name);
  private readonly redis: Redis;

  constructor(
    private readonly socketGateway: SocketGateway,
    private readonly agentService: AgentService,
    private readonly artifactService: ArtifactService,
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
  ): Promise<PptHtmlDocument> {
    try {
      const analysisContent = await this.stageAnalysis(
        sessionId,
        message,
        chatMessageId,
      );

      const courseConfig = await this.stageCourseConfig(
        sessionId,
        message,
        analysisContent,
        chatMessageId,
      );

      const videoOutline = await this.stageVideoOutline(
        sessionId,
        courseConfig,
        chatMessageId,
      );

      const slideScripts = await this.stageSlideScripts(
        sessionId,
        videoOutline,
        courseConfig,
        chatMessageId,
      );

      const theme = await this.stagePresentationTheme(
        sessionId,
        courseConfig,
        videoOutline,
        chatMessageId,
      );

      const document = await this.stageSlideGeneration(
        sessionId,
        slideScripts,
        theme,
        courseConfig,
        chatMessageId,
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

    return analysisContent;
  }

  private async stageCourseConfig(
    sessionId: string,
    topic: string,
    analysisContent: string,
    parentMessageId: string,
  ): Promise<CourseConfig> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_course_config_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_course_config',
      title: '课程配置生成',
      content: '',
      progressText: '正在生成课程配置...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const courseConfig = await this.agentService.generateCourseConfig(
      topic,
      analysisContent,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
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

    return courseConfig;
  }

  private async stageVideoOutline(
    sessionId: string,
    courseConfig: CourseConfig,
    parentMessageId: string,
  ): Promise<VideoOutline> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_video_outline_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_video_outline',
      title: '视频大纲生成',
      content: '',
      progressText: '正在生成视频大纲...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const videoOutline = await this.agentService.generateVideoOutline(
      courseConfig,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
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

    return videoOutline;
  }

  private async stageSlideScripts(
    sessionId: string,
    videoOutline: VideoOutline,
    courseConfig: CourseConfig,
    parentMessageId: string,
  ): Promise<SlideScript[]> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_slide_scripts_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_slide_scripts',
      title: 'PPT 脚本生成',
      content: '',
      progressText: '正在生成 PPT 脚本...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const slideScripts = await this.agentService.generateSlideScripts(
      videoOutline,
      courseConfig,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
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

    return slideScripts;
  }

  private async stagePresentationTheme(
    sessionId: string,
    courseConfig: CourseConfig,
    videoOutline: VideoOutline,
    parentMessageId: string,
  ): Promise<PresentationTheme> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_theme_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_presentation_theme',
      title: '主题风格生成',
      content: '',
      progressText: '正在生成主题风格...',
      parentMessageId,
      timestamp: Date.now(),
    });

    const theme = await this.agentService.generatePresentationTheme(
      courseConfig,
      videoOutline,
      () => {
        // 阶段 1-5 不发送 progress 事件
      },
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

    return theme;
  }

  private async stageSlideGeneration(
    sessionId: string,
    slideScripts: SlideScript[],
    theme: PresentationTheme,
    courseConfig: CourseConfig,
    chatMessageId: string,
  ): Promise<PptHtmlDocument> {
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_ppt_html_${uuidv4()}`;

    this.socketGateway.emitToolStart(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'generate_slides',
      title: '逐页生成 PPT HTML',
      content: '',
      progressText: '正在逐页生成 PPT HTML...',
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    const pages: SlideHtml[] = [];
    for (const script of slideScripts) {
      const page = await this.agentService.generateSlideByScript(
        script,
        theme,
        (status, progress, msg) => {
          this.socketGateway.emitProgress(sessionId, {
            status,
            progress,
            message: msg,
            artifactId,
          });
        },
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

    return document;
  }
}
