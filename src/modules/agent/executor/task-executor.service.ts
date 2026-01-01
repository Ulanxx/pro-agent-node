import { Injectable, Logger } from '@nestjs/common';
import { AgentService } from '../agent.service';
import { ArtifactService } from '../artifact.service';
import { SocketGateway } from '../../socket/socket.gateway';
import {
  Task,
  TaskType,
  TaskExecutionResult,
  ExecutionContext,
} from '../../../core/dsl/task.types';
import { Artifact } from '../../../core/dsl/types';

@Injectable()
export class TaskExecutorService {
  private readonly logger = new Logger(TaskExecutorService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly artifactService: ArtifactService,
    private readonly socketGateway: SocketGateway,
  ) {}

  /**
   * 执行单个任务
   */
  async executeTask(
    sessionId: string,
    task: Task,
    context: ExecutionContext,
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    // 先发送 tool:start 消息
    this.socketGateway.emitToolStart(sessionId, {
      id: `task_${task.id}`,
      role: 'assistant',
      kind: 'tool',
      status: 'in_progress',
      toolName: task.type,
      title: task.description,
      content: '',
      progressText: `正在执行: ${task.description}`,
      parentMessageId: context.chatMessageId || '',
      timestamp: Date.now(),
    });

    this.logger.log(`Executing task ${task.id} of type ${task.type}`);

    try {
      let result: any;

      // 根据任务类型路由到不同的执行器
      switch (task.type) {
        case TaskType.ANALYZE_TOPIC:
          result = await this.executeAnalyzeTask(task, context);
          break;
        case TaskType.GENERATE_COURSE_CONFIG:
          result = await this.executeCourseConfigTask(task, context);
          break;
        case TaskType.GENERATE_VIDEO_OUTLINE:
          result = await this.executeVideoOutlineTask(task, context);
          break;
        case TaskType.GENERATE_SLIDE_SCRIPTS:
          result = await this.executeSlideScriptsTask(task, context);
          break;
        case TaskType.GENERATE_THEME:
          result = await this.executeThemeTask(task, context);
          break;
        case TaskType.GENERATE_SLIDES:
          result = await this.executeSlidesTask(task, context);
          break;
        case TaskType.SEARCH_WEB:
          result = await this.executeWebSearchTask(task, context);
          break;
        case TaskType.REFINE_CONTENT:
          result = await this.executeRefineTask(task, context);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      const executionTime = Date.now() - startTime;

      this.socketGateway.emitToolUpdate(sessionId, {
        id: `task_${task.id}`,
        status: 'completed',
        artifactIds: result.artifactId ? [result.artifactId] : [],
      });

      this.logger.log(
        `Task ${task.id} completed successfully in ${executionTime}ms`,
      );

      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Task ${task.id} failed: ${errorMessage}`);

      this.socketGateway.emitToolUpdate(sessionId, {
        id: `task_${task.id}`,
        status: 'failed',
      });

      return {
        success: false,
        error: errorMessage,
        executionTime,
      };
    }
  }

  /**
   * 执行需求分析任务
   */
  private async executeAnalyzeTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const analysis = await this.agentService.analyzeTopic(context.topic);

    // 保存 artifact
    const artifact: Artifact = {
      id: `art_analysis_${task.id}`,
      type: 'requirement_analysis',
      content: analysis,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(context.sessionId, artifact);
    this.socketGateway.emitToolArtifact(context.sessionId, {
      messageId: `task_${task.id}`,
      showInCanvas: true,
      artifact,
    });

    return { analysis, artifactId: artifact.id };
  }

  /**
   * 执行课程配置生成任务
   */
  private async executeCourseConfigTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const analysis = this.getArtifactContent(
      context.artifacts,
      'requirement_analysis',
    );

    const courseConfig = await this.agentService.generateCourseConfig(
      context.topic,
      analysis,
      undefined,
      context.refinementPrompt,
    );

    // 保存 artifact
    const artifact: Artifact = {
      id: `art_course_config_${task.id}`,
      type: 'course_config',
      content: courseConfig,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(context.sessionId, artifact);
    this.socketGateway.emitToolArtifact(context.sessionId, {
      messageId: `task_${task.id}`,
      showInCanvas: true,
      artifact,
    });

    return { courseConfig, artifactId: artifact.id };
  }

  /**
   * 执行视频大纲生成任务
   */
  private async executeVideoOutlineTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const courseConfig = this.getArtifactContent(
      context.artifacts,
      'course_config',
    );

    const videoOutline = await this.agentService.generateVideoOutline(
      courseConfig,
      undefined,
      context.refinementPrompt,
    );

    // 保存 artifact
    const artifact: Artifact = {
      id: `art_video_outline_${task.id}`,
      type: 'video_outline',
      content: videoOutline,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(context.sessionId, artifact);
    this.socketGateway.emitToolArtifact(context.sessionId, {
      messageId: `task_${task.id}`,
      showInCanvas: true,
      artifact,
    });

    return { videoOutline, artifactId: artifact.id };
  }

  /**
   * 执行 PPT 脚本生成任务
   */
  private async executeSlideScriptsTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const videoOutline = this.getArtifactContent(
      context.artifacts,
      'video_outline',
    );
    const courseConfig = this.getArtifactContent(
      context.artifacts,
      'course_config',
    );

    const slideScripts = await this.agentService.generateSlideScripts(
      videoOutline,
      courseConfig,
      undefined,
      context.refinementPrompt,
    );

    // 保存 artifact
    const artifact: Artifact = {
      id: `art_slide_scripts_${task.id}`,
      type: 'slide_scripts',
      content: slideScripts,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(context.sessionId, artifact);
    this.socketGateway.emitToolArtifact(context.sessionId, {
      messageId: `task_${task.id}`,
      showInCanvas: true,
      artifact,
    });

    return { slideScripts, artifactId: artifact.id };
  }

  /**
   * 执行主题生成任务
   */
  private async executeThemeTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const courseConfig = this.getArtifactContent(
      context.artifacts,
      'course_config',
    );
    const videoOutline = this.getArtifactContent(
      context.artifacts,
      'video_outline',
    );

    const theme = await this.agentService.generatePresentationTheme(
      courseConfig,
      videoOutline,
      undefined,
      context.refinementPrompt,
    );

    // 保存 artifact
    const artifact: Artifact = {
      id: `art_theme_${task.id}`,
      type: 'presentation_theme',
      content: theme,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(context.sessionId, artifact);
    this.socketGateway.emitToolArtifact(context.sessionId, {
      messageId: `task_${task.id}`,
      showInCanvas: true,
      artifact,
    });

    return { theme, artifactId: artifact.id };
  }

  /**
   * 执行幻灯片生成任务
   */
  private async executeSlidesTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const slideScripts = this.getArtifactContent(
      context.artifacts,
      'slide_scripts',
    );
    const theme = this.getArtifactContent(
      context.artifacts,
      'presentation_theme',
    );
    const courseConfig = this.getArtifactContent(
      context.artifacts,
      'course_config',
    );
    const videoOutline = this.getArtifactContent(
      context.artifacts,
      'video_outline',
    );

    const pages: any[] = [];
    const totalSlides = slideScripts.length;

    for (const script of slideScripts) {
      const page = await this.agentService.generateSlideByScript(
        script,
        theme,
        videoOutline.theme,
        totalSlides,
        (status, progress, msg) => {
          this.socketGateway.emitProgress(context.sessionId, {
            status,
            progress,
            message: msg,
            artifactId: `task_${task.id}`,
          });
        },
        context.refinementPrompt,
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

    // 保存 artifact
    const artifact: Artifact = {
      id: `art_ppt_html_${task.id}`,
      type: 'ppt_html_doc',
      content: document,
      version: 'v1',
      timestamp: Date.now(),
    };

    await this.artifactService.saveArtifact(context.sessionId, artifact);
    this.socketGateway.emitToolArtifact(context.sessionId, {
      messageId: `task_${task.id}`,
      showInCanvas: true,
      artifact,
    });

    return { document, artifactId: artifact.id };
  }

  /**
   * 执行网络搜索任务
   */
  private async executeWebSearchTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const query = task.parameters.query || context.topic;

    const results = await this.agentService.performSearch(
      query,
      (artifactId, type, content) => {
        const artifact: Artifact = {
          id: artifactId,
          type: type === 'search_result' ? 'search_result' : 'web_page',
          content,
          version: 'v1',
          timestamp: Date.now(),
        };
        this.artifactService.saveArtifact(context.sessionId, artifact);
        this.socketGateway.emitToolArtifact(context.sessionId, {
          messageId: `task_${task.id}`,
          showInCanvas: true,
          artifact,
        });
      },
    );

    return { searchResults: results };
  }

  /**
   * 执行内容优化任务
   */
  private async executeRefineTask(
    task: Task,
    context: ExecutionContext,
  ): Promise<any> {
    const taskId = task.parameters.taskId;
    const issues = task.parameters.issues || [];

    // 获取要优化的任务结果
    const targetTask = context.taskList.tasks.find((t) => t.id === taskId);
    if (!targetTask) {
      throw new Error(`Target task ${taskId} not found`);
    }

    // 根据任务类型重新执行，带上优化提示
    let result: any;
    const refinedContext = {
      ...context,
      refinementPrompt: `请根据以下问题优化内容：${issues.join('; ')}`,
    };

    switch (targetTask.type) {
      case TaskType.GENERATE_COURSE_CONFIG:
        result = await this.executeCourseConfigTask(targetTask, refinedContext);
        break;
      case TaskType.GENERATE_VIDEO_OUTLINE:
        result = await this.executeVideoOutlineTask(targetTask, refinedContext);
        break;
      case TaskType.GENERATE_SLIDE_SCRIPTS:
        result = await this.executeSlideScriptsTask(
          targetTask,
          refinedContext,
        );
        break;
      case TaskType.GENERATE_THEME:
        result = await this.executeThemeTask(targetTask, refinedContext);
        break;
      default:
        throw new Error(
          `Refinement not supported for task type: ${targetTask.type}`,
        );
    }

    return { refinedResult: result };
  }

  /**
   * 从 artifacts 中获取指定类型的内容
   */
  private getArtifactContent(artifacts: any[], type: string): any {
    const artifact = artifacts.find((a) => a.type === type);
    if (!artifact) {
      throw new Error(`Artifact of type ${type} not found`);
    }
    return artifact.content;
  }
}
