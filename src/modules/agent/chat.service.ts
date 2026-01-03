import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SocketGateway } from '../socket/socket.gateway';
import { AgentService } from '../agent/agent.service';
import { Chat5StageService } from './chat-5-stage.service';
import { ArtifactService } from './artifact.service';
import { IntentClassifier, UserIntent } from './intent-classifier.service';
import { AutonomousGraphService } from './graph/autonomous-graph.service';
import { Redis } from 'ioredis';
import { Artifact } from '../../core/dsl/types';
import { JobStartMetaDataPayload } from 'src/shared/types/process';
import { Message, AssistantToolMessage } from '../../shared/types/message';
import {
  Message as MessageEntity,
  MessageRole,
  MessageKind,
} from '../database/entities/message.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly redis: Redis;

  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    private readonly socketGateway: SocketGateway,
    private readonly agentService: AgentService,
    private readonly chat5StageService: Chat5StageService,
    private readonly artifactService: ArtifactService,
    private readonly intentClassifier: IntentClassifier,
    private readonly autonomousGraphService: AutonomousGraphService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async handleMessage(
    sessionId: string,
    message: string,
    metaData: JobStartMetaDataPayload,
  ) {
    this.logger.log(
      `Handling message for session ${sessionId}: ${message}, metadata: ${JSON.stringify(metaData, null, 2)}`,
    );

    await this.saveMessage(sessionId, {
      role: 'user',
      content: message,
      status: 'completed',
      metadata: metaData,
    });

    const history = await this.getSessionHistory(sessionId);
    const classification = await this.intentClassifier.classify(
      message,
      history,
    );

    // 判断是否使用自主规划模式
    const useAutonomousPlanning = this.shouldUseAutonomousPlanning(
      message,
      classification,
      history,
    );

    const chatMessageId = `msg_${uuidv4()}`;

    this.logger.log(
      `Using ${useAutonomousPlanning ? 'Autonomous Planning' : '5-Stage'} PPT generation flow. Intent: ${classification.intent}, Target Stage: ${classification.targetStage}`,
    );

    // 处理与 PPT 生成无关的内容
    if (classification.intent === UserIntent.IRRELEVANT) {
      const irrelevantMessage = `您好！我是专业的 PPT 生成助手，可以帮助您创建各种主题的教学演示文稿。

请告诉我您需要制作什么主题的 PPT，比如：
• "帮我做一个关于人工智能的 PPT"
• "制作一份 Python 编程入门的演示文稿"
• "生成一份关于市场营销策略的课程 PPT"

您可以提供主题、目标受众、页数要求等信息，我会为您生成专业的 PPT。`;

      this.socketGateway.emitMessageStart(sessionId, {
        id: chatMessageId,
        role: 'assistant',
        content: '',
      });

      this.socketGateway.emitMessageChunk(sessionId, {
        id: chatMessageId,
        chunk: irrelevantMessage,
      });

      await this.saveMessage(sessionId, {
        id: chatMessageId,
        role: 'assistant',
        kind: 'chat',
        content: irrelevantMessage,
        timestamp: Date.now(),
      });

      return;
    }

    if (classification.intent === UserIntent.REFINEMENT) {
      const welcomeMessage = `收到您的反馈：“${message}”。我将为您优化 PPT 的 ${classification.targetStage} 阶段及后续流程。`;

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
        classification.targetStage,
      );
      return;
    }

    if (useAutonomousPlanning) {
      const welcomeMessage = '我将使用自主规划模式为您生成专业的教学 PPT。';

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
      // 使用自主规划模式
      const document = await this.autonomousGraphService.execute(
        sessionId,
        message,
        chatMessageId,
        {
          history,
          existingArtifacts: await this.getSessionArtifacts(sessionId),
        },
      );

      if (document) {
        this.logger.log(
          `Autonomous planning completed successfully for session ${sessionId}`,
        );
      }
    } else {
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
      // 使用原有的 5 阶段流程
      await this.chat5StageService.handle5StagePPTGeneration(
        sessionId,
        message,
        chatMessageId,
      );
    }
  }

  async saveMessage(sessionId: string, message: Message) {
    const key = `chat:history:${sessionId}`;
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.expire(key, 86400);

    // 同时保存到 MySQL
    const messageEntity = this.messageRepository.create({
      applicationId: sessionId,
      role: message.role === 'user' ? MessageRole.USER : MessageRole.ASSISTANT,
      kind:
        'kind' in message
          ? message.kind === 'tool'
            ? MessageKind.TOOL
            : MessageKind.CHAT
          : MessageKind.CHAT,
      content: message.content,
      metadata:
        'id' in message
          ? {
              id: message.id,
              ...('metadata' in message && message.metadata
                ? message.metadata
                : {}),
            }
          : {},
      timestamp: Date.now(),
    });

    await this.messageRepository.save(messageEntity);
  }

  async updateToolMessage(
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

  /**
   * 判断是否应该使用自主规划模式
   */
  private shouldUseAutonomousPlanning(
    message: string,
    classification: any,
    history: Message[],
  ): boolean {
    // 如果用户明确要求自主规划，或者历史记录为空，使用自主规划
    const hasAutonomousKeyword =
      message.includes('自主') ||
      message.includes('自动') ||
      message.includes('AI 规划') ||
      message.includes('智能');

    const isNewSession = !history || history.length === 0;

    return hasAutonomousKeyword || isNewSession;
  }
}
