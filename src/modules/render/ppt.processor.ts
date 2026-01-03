import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { RenderService } from '../render/render.service';
import { SocketGateway } from '../socket/socket.gateway';
import { ArtifactService } from '../agent/artifact.service';

@Processor('ppt-generation')
export class PptProcessor extends WorkerHost {
  private readonly logger = new Logger(PptProcessor.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly renderService: RenderService,
    private readonly socketGateway: SocketGateway,
    private readonly artifactService: ArtifactService,
  ) {
    super();
  }

  async process(
    job: Job<{ topic: string; sessionId?: string }, any, string>,
  ): Promise<any> {
    // todo
  }
}
