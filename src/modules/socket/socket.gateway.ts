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
import { JobStartMetaDataPayload } from 'src/shared/types/process';
import { Artifact } from '../../core/dsl/types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
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
}
