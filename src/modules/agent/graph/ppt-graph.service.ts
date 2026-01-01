import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { AgentService } from '../agent.service';
import { ArtifactService } from '../artifact.service';
import { ChatService } from '../chat.service';
import { SocketGateway } from '../../socket/socket.gateway';
import { AgentState, AgentStateType } from './state';
import { TargetStage } from '../intent-classifier.service';
import { v4 as uuidv4 } from 'uuid';
import {
  Artifact,
  CourseConfig,
  VideoOutline,
  SlideScript,
  PresentationTheme,
  PptHtmlDocument,
} from '../../../core/dsl/types';

@Injectable()
export class PptGraphService {
  private readonly logger = new Logger(PptGraphService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly socketGateway: SocketGateway,
  ) {}

  /**
   * 创建并编译 PPT 生成图
   * @param entryStage 入口阶段，决定从哪个节点开始执行
   */
  createGraph(entryStage: TargetStage = TargetStage.ANALYSIS) {
    const workflow = new StateGraph(AgentState)
      .addNode('analysisNode', (state) => this.analysisNode(state))
      .addNode('courseConfigNode', (state) => this.courseConfigNode(state))
      .addNode('videoOutlineNode', (state) => this.videoOutlineNode(state))
      .addNode('slideScriptsNode', (state) => this.slideScriptsNode(state))
      .addNode('themeNode', (state) => this.themeNode(state))
      .addNode('slidesNode', (state) => this.slidesNode(state));

    // 根据入口阶段设置起始节点
    const entryNode = this.getEntryNode(entryStage);

    // 构建图的边
    workflow.addEdge(START, entryNode);

    // 添加后续边的逻辑
    if (entryStage !== TargetStage.SLIDES) {
      workflow.addEdge('themeNode', 'slidesNode');
    }
    if (entryStage !== TargetStage.THEME && entryStage !== TargetStage.SLIDES) {
      workflow.addEdge('slideScriptsNode', 'themeNode');
    }
    if (
      entryStage !== TargetStage.SLIDE_SCRIPTS &&
      entryStage !== TargetStage.THEME &&
      entryStage !== TargetStage.SLIDES
    ) {
      workflow.addEdge('videoOutlineNode', 'slideScriptsNode');
    }
    if (
      entryStage !== TargetStage.VIDEO_OUTLINE &&
      entryStage !== TargetStage.SLIDE_SCRIPTS &&
      entryStage !== TargetStage.THEME &&
      entryStage !== TargetStage.SLIDES
    ) {
      workflow.addEdge('courseConfigNode', 'videoOutlineNode');
    }
    if (
      entryStage !== TargetStage.COURSE_CONFIG &&
      entryStage !== TargetStage.VIDEO_OUTLINE &&
      entryStage !== TargetStage.SLIDE_SCRIPTS &&
      entryStage !== TargetStage.THEME &&
      entryStage !== TargetStage.SLIDES
    ) {
      workflow.addEdge('analysisNode', 'courseConfigNode');
    }

    workflow.addEdge('slidesNode', END);

    return workflow.compile({
      checkpointer: new MemorySaver(),
    });
  }

  /**
   * 根据目标阶段获取对应的节点名称
   */
  private getEntryNode(
    entryStage: TargetStage,
  ):
    | 'analysisNode'
    | 'courseConfigNode'
    | 'videoOutlineNode'
    | 'slideScriptsNode'
    | 'themeNode'
    | 'slidesNode' {
    switch (entryStage) {
      case TargetStage.ANALYSIS:
        return 'analysisNode';
      case TargetStage.COURSE_CONFIG:
        return 'courseConfigNode';
      case TargetStage.VIDEO_OUTLINE:
        return 'videoOutlineNode';
      case TargetStage.SLIDE_SCRIPTS:
        return 'slideScriptsNode';
      case TargetStage.THEME:
        return 'themeNode';
      case TargetStage.SLIDES:
        return 'slidesNode';
      default:
        return 'analysisNode';
    }
  }

  /**
   * 执行 PPT 生成流程
   */
  async execute(
    sessionId: string,
    topic: string,
    chatMessageId: string,
    entryStage: TargetStage = TargetStage.ANALYSIS,
    refinementPrompt?: string,
  ) {
    const graph = this.createGraph(entryStage);

    // 加载之前阶段的状态（如果是优化模式）
    const previousState = await this.loadPreviousState(sessionId, entryStage);

    const initialState = {
      sessionId,
      topic,
      chatMessageId,
      entryStage,
      refinementPrompt,
      ...previousState,
    };

    const config = { configurable: { thread_id: sessionId } };

    try {
      const result = await graph.invoke(initialState, config);
      return result.document;
    } catch (error) {
      this.logger.error(`Graph execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * 从 Redis 加载之前阶段的状态
   * @param sessionId 会话 ID
   * @param entryStage 入口阶段
   * @returns 之前阶段的状态对象
   */
  private async loadPreviousState(
    sessionId: string,
    entryStage: TargetStage,
  ): Promise<Partial<AgentStateType>> {
    // 如果是从分析阶段开始，不需要加载之前的状态
    if (entryStage === TargetStage.ANALYSIS) {
      return {};
    }

    // 获取会话的所有 artifacts
    const artifacts = await this.artifactService.getArtifacts(sessionId);
    const state: Partial<AgentStateType> = {};

    // 根据 artifact 类型加载对应的状态
    for (const artifact of artifacts) {
      switch (artifact.type) {
        case 'requirement_analysis':
          state.analysis = artifact.content as string;
          break;
        case 'course_config':
          state.courseConfig = artifact.content as CourseConfig;
          break;
        case 'video_outline':
          state.videoOutline = artifact.content as VideoOutline;
          break;
        case 'slide_scripts':
          state.slideScripts = artifact.content as SlideScript[];
          break;
        case 'presentation_theme':
          state.theme = artifact.content as PresentationTheme;
          break;
        case 'ppt_html_doc':
          state.document = artifact.content as PptHtmlDocument;
          break;
      }
    }

    this.logger.log(
      `Loaded previous state for session ${sessionId}: ${Object.keys(state).join(', ')}`,
    );

    return state;
  }

  // --- Nodes ---

  private async analysisNode(state: AgentStateType) {
    const { sessionId, topic, chatMessageId } = state;
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_analysis_${uuidv4()}`;

    this.emitToolStart(
      sessionId,
      toolMessageId,
      chatMessageId,
      'analyze_topic',
      '需求分析',
      '正在分析需求...',
    );

    await this.chatService.saveMessage(sessionId, {
      id: toolMessageId,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: 'analyze_topic',
      title: '需求分析',
      content: '',
      progressText: '正在分析需求...',
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    const analysis = await this.agentService.analyzeTopic(topic);

    const artifact: Artifact = {
      id: artifactId,
      type: 'requirement_analysis',
      content: analysis,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.saveArtifactAndNotify(sessionId, toolMessageId, artifact);

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return { analysis, currentStage: TargetStage.ANALYSIS };
  }

  private async courseConfigNode(state: AgentStateType) {
    const { sessionId, topic, analysis, chatMessageId, refinementPrompt } =
      state;
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_course_config_${uuidv4()}`;

    this.emitToolStart(
      sessionId,
      toolMessageId,
      chatMessageId,
      'generate_course_config',
      refinementPrompt ? '课程配置优化' : '课程配置生成',
      refinementPrompt ? '正在优化课程配置...' : '正在生成课程配置...',
    );

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
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    const courseConfig = await this.agentService.generateCourseConfig(
      topic,
      analysis,
      undefined,
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'course_config',
      content: courseConfig,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.saveArtifactAndNotify(sessionId, toolMessageId, artifact);

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return { courseConfig, currentStage: TargetStage.COURSE_CONFIG };
  }

  private async videoOutlineNode(state: AgentStateType) {
    const { sessionId, courseConfig, chatMessageId, refinementPrompt } = state;
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_video_outline_${uuidv4()}`;

    this.emitToolStart(
      sessionId,
      toolMessageId,
      chatMessageId,
      'generate_video_outline',
      refinementPrompt ? '视频大纲优化' : '视频大纲生成',
      refinementPrompt ? '正在优化视频大纲...' : '正在生成视频大纲...',
    );

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
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    const videoOutline = await this.agentService.generateVideoOutline(
      courseConfig,
      undefined,
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'video_outline',
      content: videoOutline,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.saveArtifactAndNotify(sessionId, toolMessageId, artifact);

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return { videoOutline, currentStage: TargetStage.VIDEO_OUTLINE };
  }

  private async slideScriptsNode(state: AgentStateType) {
    const {
      sessionId,
      videoOutline,
      courseConfig,
      chatMessageId,
      refinementPrompt,
    } = state;
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_slide_scripts_${uuidv4()}`;

    this.emitToolStart(
      sessionId,
      toolMessageId,
      chatMessageId,
      'generate_slide_scripts',
      refinementPrompt ? 'PPT 脚本优化' : 'PPT 脚本生成',
      refinementPrompt ? '正在优化 PPT 脚本...' : '正在生成 PPT 脚本...',
    );

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
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    const slideScripts = await this.agentService.generateSlideScripts(
      videoOutline,
      courseConfig,
      undefined,
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'slide_scripts',
      content: slideScripts,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.saveArtifactAndNotify(sessionId, toolMessageId, artifact);

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return { slideScripts, currentStage: TargetStage.SLIDE_SCRIPTS };
  }

  private async themeNode(state: AgentStateType) {
    const {
      sessionId,
      courseConfig,
      videoOutline,
      chatMessageId,
      refinementPrompt,
    } = state;
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_theme_${uuidv4()}`;

    this.emitToolStart(
      sessionId,
      toolMessageId,
      chatMessageId,
      'generate_presentation_theme',
      refinementPrompt ? '主题风格优化' : '主题风格生成',
      refinementPrompt ? '正在优化主题风格...' : '正在生成主题风格...',
    );

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
      parentMessageId: chatMessageId,
      timestamp: Date.now(),
    });

    const theme = await this.agentService.generatePresentationTheme(
      courseConfig,
      videoOutline,
      undefined,
      refinementPrompt,
    );

    const artifact: Artifact = {
      id: artifactId,
      type: 'presentation_theme',
      content: theme,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.saveArtifactAndNotify(sessionId, toolMessageId, artifact);

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return { theme, currentStage: TargetStage.THEME };
  }

  private async slidesNode(state: AgentStateType) {
    const {
      sessionId,
      slideScripts,
      theme,
      courseConfig,
      videoOutline,
      chatMessageId,
      refinementPrompt,
    } = state;
    const toolMessageId = `tool_${uuidv4()}`;
    const artifactId = `art_ppt_html_${uuidv4()}`;

    this.emitToolStart(
      sessionId,
      toolMessageId,
      chatMessageId,
      'generate_slides',
      refinementPrompt ? '逐页优化 PPT HTML' : '逐页生成 PPT HTML',
      refinementPrompt
        ? '正在逐页优化 PPT HTML...'
        : '正在逐页生成 PPT HTML...',
    );

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

    const pages: any[] = [];
    for (const script of slideScripts) {
      const page = await this.agentService.generateSlideByScript(
        script,
        theme,
        videoOutline.theme,
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

    const document = {
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

    await this.saveArtifactAndNotify(sessionId, toolMessageId, artifact);

    await this.chatService.updateToolMessage(sessionId, toolMessageId, {
      status: 'completed',
      artifactIds: [artifactId],
    });

    return { document, currentStage: TargetStage.SLIDES };
  }

  // --- Helpers ---

  private emitToolStart(
    sessionId: string,
    id: string,
    parentMessageId: string,
    toolName: string,
    title: string,
    progressText: string,
  ) {
    this.socketGateway.emitToolStart(sessionId, {
      id,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName,
      title,
      content: '',
      progressText,
      parentMessageId,
      timestamp: Date.now(),
    });
  }

  private async saveArtifactAndNotify(
    sessionId: string,
    toolMessageId: string,
    artifact: Artifact,
  ) {
    await this.artifactService.saveArtifact(sessionId, artifact);
    this.socketGateway.emitToolArtifact(sessionId, {
      messageId: toolMessageId,
      showInCanvas: true,
      artifact,
    });
    this.socketGateway.emitToolUpdate(sessionId, {
      id: toolMessageId,
      status: 'completed',
      artifactIds: [artifact.id],
    });
  }
}
