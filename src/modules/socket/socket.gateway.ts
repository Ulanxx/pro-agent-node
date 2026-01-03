import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { ChatService } from '../agent/chat.service';
import { ApplicationService } from '../application/application.service';
import { ArtifactService } from '../application/artifact.service';
import { TaskService } from '../application/task.service';
import { JobStartMetaDataPayload } from 'src/shared/types/process';
import { Artifact } from '../../core/dsl/types';
import { v4 as uuidv4 } from 'uuid';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingTimeout: 60000, // 60秒ping超时
  pingInterval: 25000, // 25秒ping间隔
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly applicationService: ApplicationService,
    private readonly artifactService: ArtifactService,
    private readonly taskService: TaskService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(client: Socket, jobId: string) {
    await client.join(`job_${jobId}`);
    this.logger.log(`Client ${client.id} subscribed to job: ${jobId}`);
    return { status: 'subscribed', jobId };
  }

  @SubscribeMessage('chat:send')
  async handleChatMessage(
    client: Socket,
    data: {
      message: string;
      sessionId?: string;
      metadata: JobStartMetaDataPayload;
    },
  ) {
    const sessionId = data.sessionId || client.id;
    await client.join(`session_${sessionId}`);
    this.logger.log(
      `Received chat message from ${client.id} for session ${sessionId}: ${data.message}`,
    );

    // Process message via ChatService
    await this.chatService.handleMessage(
      sessionId,
      data.message,
      data.metadata,
    );

    return { status: 'received', sessionId };
  }

  @SubscribeMessage('chat:init')
  async handleChatInit(client: Socket, data: { sessionId: string }) {
    const { sessionId } = data;
    await client.join(`session_${sessionId}`);
    this.logger.log(
      `Chat initialized for session ${sessionId} by client ${client.id}`,
    );

    // Fetch history from ChatService
    const messages = await this.chatService.getSessionHistory(sessionId);
    const artifacts = await this.chatService.getSessionArtifacts(sessionId);

    // Emit response event as per protocol doc
    this.server.to(`session_${sessionId}`).emit('chat:init:response', {
      status: 'success',
      messages,
      artifacts,
    });

    return { status: 'success', messages, artifacts };
  }

  /**
   * Application-based events
   */

  @SubscribeMessage('app:subscribe')
  async handleAppSubscribe(client: Socket, data: { applicationId: string }) {
    const { applicationId } = data;
    await client.join(`app_${applicationId}`);
    this.logger.log(
      `Client ${client.id} subscribed to application: ${applicationId}`,
    );

    // Load application data
    const application = await this.applicationService.findOne(applicationId);
    const artifacts =
      await this.artifactService.findByApplicationId(applicationId);
    const tasks = await this.taskService.findTaskTree(applicationId);

    // Emit initial data
    this.server.to(`app_${applicationId}`).emit('app:init:response', {
      status: 'success',
      application,
      artifacts,
      tasks,
    });

    return { status: 'subscribed', applicationId };
  }

  @SubscribeMessage('app:send:message')
  async handleAppSendMessage(
    client: Socket,
    data: {
      applicationId: string;
      message: string;
      role?: 'user' | 'assistant';
      kind?: 'chat' | 'tool';
    },
  ) {
    const { applicationId, message, role = 'user', kind = 'chat' } = data;

    this.logger.log(
      `Received message for app ${applicationId} from client ${client.id}`,
    );

    // TODO: Create MessageService to handle message persistence
    // For now, just emit the message
    const messageData = {
      id: `msg_${uuidv4()}`,
      applicationId,
      role,
      kind,
      content: message,
      timestamp: Date.now(),
    };

    // Broadcast to all subscribers
    this.server.to(`app_${applicationId}`).emit('app:message:created', {
      message: messageData,
    });

    return { status: 'received', messageId: messageData.id };
  }
  emitProgress(
    targetId: string,
    data: {
      status: string;
      progress: number;
      message?: string;
      artifactId?: string;
    },
  ) {
    const normalizedProgress = Math.min(100, Math.round(data.progress));
    // Try both job and session rooms for backward compatibility
    this.server
      .to(`job_${targetId}`)
      .to(`session_${targetId}`)
      .emit('progress', { ...data, progress: normalizedProgress });
  }

  emitToolStart(
    sessionId: string,
    data: {
      id: string;
      role: 'assistant';
      kind: 'tool';
      status: 'in_progress';
      toolName: string;
      title?: string;
      content: string;
      progressText?: string;
      parentMessageId?: string;
      timestamp: number;
    },
  ) {
    this.server.to(`session_${sessionId}`).emit('tool:start', data);
  }

  emitToolUpdate(
    sessionId: string,
    data: {
      id: string;
      status: 'completed' | 'failed';
      content?: string;
      artifactIds?: string[];
    },
  ) {
    this.server.to(`session_${sessionId}`).emit('tool:update', data);
  }

  emitMessageStart(
    sessionId: string,
    data: {
      id: string;
      role: string;
      content: string;
    },
  ) {
    this.server.to(`session_${sessionId}`).emit('message:start', data);
  }

  emitMessageChunk(
    sessionId: string,
    data: {
      id: string;
      chunk: string;
    },
  ) {
    this.server.to(`session_${sessionId}`).emit('message:chunk', data);
  }

  emitToolArtifact(
    sessionId: string,
    data: {
      messageId: string;
      showInCanvas: boolean;
      artifact: Artifact;
    },
  ) {
    this.server.to(`session_${sessionId}`).emit('tool:artifact', data);
  }

  emitCompletion(
    targetId: string,
    data: {
      success: boolean;
      result?: any;
      error?: string;
      finalArtifactId?: string;
    },
  ) {
    this.server
      .to(`job_${targetId}`)
      .to(`session_${targetId}`)
      .emit('completion', data);
  }

  /**
   * Application-based event emitters
   */

  emitAppStatusUpdate(
    applicationId: string,
    data: {
      status: string;
      updatedAt: Date;
    },
  ) {
    this.server.to(`app_${applicationId}`).emit('app:status:update', data);
  }

  emitAppProgressUpdate(
    applicationId: string,
    data: {
      progress: number;
      message?: string;
      currentStep?: string;
    },
  ) {
    const normalizedProgress = Math.min(100, Math.round(data.progress));
    this.server.to(`app_${applicationId}`).emit('app:progress:update', {
      ...data,
      progress: normalizedProgress,
    });
  }

  emitArtifactCreated(
    applicationId: string,
    data: {
      artifactId: string;
      type: string;
      title?: string;
      storageUrl?: string;
      createdAt: Date;
    },
  ) {
    this.server.to(`app_${applicationId}`).emit('artifact:created', data);
  }

  emitTaskUpdate(
    applicationId: string,
    data: {
      taskId: string;
      status: string;
      name: string;
      startedAt?: Date;
      completedAt?: Date;
      output?: any;
    },
  ) {
    this.server.to(`app_${applicationId}`).emit('task:update', data);
  }

  emitMessageCreated(
    applicationId: string,
    data: {
      messageId: string;
      role: string;
      kind: string;
      content: string;
      timestamp: number;
    },
  ) {
    this.server.to(`app_${applicationId}`).emit('message:created', data);
  }
}
