import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from '../socket/socket.gateway';
import { PptGraphService } from './graph/ppt-graph.service';
import { PptHtmlDocument } from '../../core/dsl/types';
import { TargetStage } from './intent-classifier.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class Chat5StageService {
  private readonly logger = new Logger(Chat5StageService.name);

  constructor(
    private readonly socketGateway: SocketGateway,
    private readonly pptGraphService: PptGraphService,
  ) {}

  async handle5StagePPTGeneration(
    sessionId: string,
    message: string,
    chatMessageId: string,
    entryStage: TargetStage = TargetStage.ANALYSIS,
  ): Promise<PptHtmlDocument> {
    try {
      this.logger.log(
        `Starting 5-stage PPT generation via LangGraph for session: ${sessionId}`,
      );

      const document = await this.pptGraphService.execute(
        sessionId,
        message,
        chatMessageId,
        entryStage,
      );

      this.socketGateway.emitCompletion(sessionId, {
        success: true,
        finalArtifactId: `art_dsl_${uuidv4()}`,
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
}
