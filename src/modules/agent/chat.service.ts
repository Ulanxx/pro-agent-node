import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SocketGateway } from '../socket/socket.gateway';
import { AgentService } from '../agent/agent.service';
import { Chat5StageService } from './chat-5-stage.service';
import { ArtifactService } from './artifact.service';
import { Redis } from 'ioredis';
import { Artifact } from '../../core/dsl/types';
import { JobStartMetaDataPayload } from 'src/shared/types/process';
import { Message, AssistantToolMessage } from '../../shared/types/message';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly redis: Redis;
  private readonly use5StageFlow: boolean;

  constructor(
    private readonly socketGateway: SocketGateway,
    private readonly agentService: AgentService,
    private readonly chat5StageService: Chat5StageService,
    private readonly artifactService: ArtifactService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
    this.use5StageFlow = process.env.USE_5_STAGE_FLOW === 'true';
  }

  async handleMessage(
    sessionId: string,
    message: string,
    metaData: JobStartMetaDataPayload,
  ) {
    this.logger.log(`Handling message for session ${sessionId}: ${message}`);

    await this.saveMessage(sessionId, {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    const chatMessageId = `msg_${uuidv4()}`;

    if (this.use5StageFlow) {
      this.logger.log('Using 5-stage PPT generation flow');
      const welcomeMessage =
        '我将使用 5 阶段流程为您生成专业的教学 PPT：课程配置 → 视频大纲 → PPT 脚本 → 主题风格 → 逐页生成。';

      this.socketGateway.emitMessageStart(sessionId, {
        id: chatMessageId,
        role: 'assistant',
        content: '',
      });

      this.socketGateway.emitMessageChunk(sessionId, {
        id: chatMessageId,
        chunk: welcomeMessage,
      });

      await this.saveMessage(sessionId, {
        id: chatMessageId,
        role: 'assistant',
        kind: 'chat',
        content: welcomeMessage,
        timestamp: Date.now(),
      });

      await this.chat5StageService.handle5StagePPTGeneration(
        sessionId,
        message,
        chatMessageId,
      );
      return;
    }

    try {
      const analysisId = `art_analysis_${uuidv4()}`;
      const planId = `art_plan_${uuidv4()}`;

      let welcomeMessage = '让我先规划整个任务。';
      if (metaData?.file) {
        welcomeMessage = `我将为您分析文件 "${metaData.file.name}"。让我先规划整个任务。`;
      } else if (metaData?.url) {
        welcomeMessage = `我将为您分析网页内容 ${metaData.url}。让我先规划整个任务。`;
      } else {
        const shortDesc =
          message.length > 20 ? message.substring(0, 20) + '...' : message;
        welcomeMessage = `我将为您处理关于 "${shortDesc}" 的需求。让我先规划整个任务。`;
      }

      this.socketGateway.emitMessageStart(sessionId, {
        id: chatMessageId,
        role: 'assistant',
        content: '',
      });

      this.socketGateway.emitMessageChunk(sessionId, {
        id: chatMessageId,
        chunk: welcomeMessage,
      });

      await this.saveMessage(sessionId, {
        id: chatMessageId,
        role: 'assistant',
        kind: 'chat',
        content: welcomeMessage,
        timestamp: Date.now(),
      });

      const analysisToolMessageId = `tool_${uuidv4()}`;
      this.socketGateway.emitToolMessageStart(sessionId, {
        id: analysisToolMessageId,
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

      const analysisToolMessage: AssistantToolMessage = {
        id: analysisToolMessageId,
        role: 'assistant',
        kind: 'tool',
        status: 'in_progress',
        toolName: 'analyze_topic',
        title: '需求分析',
        content: '',
        progressText: '正在分析需求...',
        parentMessageId: chatMessageId,
        artifactIds: [],
        timestamp: Date.now(),
      };
      await this.saveToolMessage(sessionId, analysisToolMessage);

      const analysisContent = await this.agentService.analyzeTopic(
        message,
        async (status: string, progress: number, msg: string) => {
          this.socketGateway.emitProgress(sessionId, {
            status,
            progress,
            message: msg,
            artifactId: analysisId,
          });

          this.socketGateway.emitToolMessageUpdate(sessionId, {
            id: analysisToolMessageId,
            patch: {
              progressText: msg,
            },
            timestamp: Date.now(),
          });

          await this.updateToolMessage(sessionId, analysisToolMessageId, {
            progressText: msg,
          });
        },
      );

      const analysisArtifact: Artifact = {
        id: analysisId,
        type: 'requirement_analysis',
        content: analysisContent,
        version: 'v1',
        timestamp: Date.now(),
      };

      await this.artifactService.saveArtifact(sessionId, analysisArtifact);

      this.socketGateway.emitToolArtifact(sessionId, {
        messageId: analysisToolMessageId,
        showInCanvas: true,
        artifact: analysisArtifact,
      });

      await this.updateToolMessage(sessionId, analysisToolMessageId, {
        artifactIds: [analysisId],
      });

      this.socketGateway.emitToolMessageComplete(sessionId, {
        id: analysisToolMessageId,
        status: 'completed',
        timestamp: Date.now(),
      });

      await this.updateToolMessage(sessionId, analysisToolMessageId, {
        status: 'completed',
        progressText: '需求分析完成',
      });

      const planToolMessageId = `tool_${uuidv4()}`;
      this.socketGateway.emitToolMessageStart(sessionId, {
        id: planToolMessageId,
        role: 'assistant',
        kind: 'tool',
        status: 'in_progress',
        toolName: 'plan_document',
        title: '任务规划',
        content: '',
        progressText: '正在规划任务...',
        parentMessageId: chatMessageId,
        timestamp: Date.now(),
      });

      const planToolMessage: AssistantToolMessage = {
        id: planToolMessageId,
        role: 'assistant',
        kind: 'tool',
        status: 'in_progress',
        toolName: 'plan_document',
        title: '任务规划',
        content: '',
        progressText: '正在规划任务...',
        parentMessageId: chatMessageId,
        artifactIds: [],
        timestamp: Date.now(),
      };
      await this.saveToolMessage(sessionId, planToolMessage);

      const plan = await this.agentService.planDocument(
        message,
        analysisContent,
        metaData,
        async (status: string, progress: number, msg: string) => {
          this.socketGateway.emitProgress(sessionId, {
            status,
            progress,
            message: msg,
            artifactId: planId,
          });

          this.socketGateway.emitToolMessageUpdate(sessionId, {
            id: planToolMessageId,
            patch: {
              progressText: msg,
            },
            timestamp: Date.now(),
          });

          await this.updateToolMessage(sessionId, planToolMessageId, {
            progressText: msg,
          });
        },
      );

      const planArtifact: Artifact = {
        id: planId,
        type: 'plan',
        content: plan,
        version: 'v1',
        timestamp: Date.now(),
      };

      await this.artifactService.saveArtifact(sessionId, planArtifact);

      this.socketGateway.emitToolArtifact(sessionId, {
        messageId: planToolMessageId,
        showInCanvas: true,
        artifact: planArtifact,
      });

      await this.updateToolMessage(sessionId, planToolMessageId, {
        artifactIds: [planId],
      });

      this.socketGateway.emitToolMessageComplete(sessionId, {
        id: planToolMessageId,
        status: 'completed',
        timestamp: Date.now(),
      });

      await this.updateToolMessage(sessionId, planToolMessageId, {
        status: 'completed',
        progressText: '任务规划完成',
      });

      this.socketGateway.emitCompletion(sessionId, {
        success: true,
        finalArtifactId: planId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle chat message: ${error}`);
      this.socketGateway.emitCompletion(sessionId, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async saveMessage(sessionId: string, message: Message) {
    const key = `chat:history:${sessionId}`;
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.expire(key, 86400);
  }

  private async saveToolMessage(
    sessionId: string,
    toolMessage: AssistantToolMessage,
  ) {
    const key = `chat:history:${sessionId}`;
    await this.redis.rpush(key, JSON.stringify(toolMessage));
    await this.redis.expire(key, 86400);
  }

  private async updateToolMessage(
    sessionId: string,
    toolMessageId: string,
    updates: Partial<AssistantToolMessage>,
  ) {
    const key = `chat:history:${sessionId}`;
    const messages = await this.redis.lrange(key, 0, -1);
    const parsedMessages = messages.map((m) => JSON.parse(m) as Message);

    const index = parsedMessages.findIndex(
      (m) =>
        'id' in m && 'kind' in m && m.id === toolMessageId && m.kind === 'tool',
    );

    if (index !== -1) {
      const toolMsg = parsedMessages[index] as AssistantToolMessage;
      parsedMessages[index] = { ...toolMsg, ...updates } as Message;
      await this.redis.del(key);
      for (const msg of parsedMessages) {
        await this.redis.rpush(key, JSON.stringify(msg));
      }
      await this.redis.expire(key, 86400);
    }
  }

  async getSessionHistory(sessionId: string): Promise<Message[]> {
    const key = `chat:history:${sessionId}`;
    const messages = await this.redis.lrange(key, 0, -1);
    return messages.map((m) => JSON.parse(m));
  }

  async getSessionArtifacts(sessionId: string): Promise<Artifact[]> {
    return this.artifactService.getArtifacts(sessionId);
  }
}
