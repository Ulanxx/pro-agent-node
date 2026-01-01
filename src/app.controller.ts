import { Controller, Logger } from '@nestjs/common';
import { AgentService } from './modules/agent/agent.service';
import { RenderService } from './modules/render/render.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly renderService: RenderService,
    @InjectQueue('ppt-generation') private readonly pptQueue: Queue,
  ) {}

  // @Post('generate')
  // async generate(@Body('topic') topic: string, @Res() res: Response) {
  //   if (!topic) {
  //     return res.status(400).send('Topic is required');
  //   }

  //   try {
  //     this.logger.log(`Generating presentation for topic: ${topic}`);

  //     const doc = await this.agentService.generateDocument(topic);
  //     const buffer = await this.renderService.renderToPpt(doc);

  //     res.set({
  //       'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  //       'Content-Disposition': `attachment; filename="presentation.pptx"`,
  //       'Content-Length': buffer.length,
  //     });

  //     res.end(buffer);
  //   } catch (error) {
  //     this.logger.error(`Generation failed: ${error.message}`);
  //     res.status(500).send('Failed to generate presentation');
  //   }
  // }

  // @Post('generate/async')
  // async generateAsync(@Body('topic') topic: string, @Body('sessionId') sessionId?: string) {
  //   if (!topic) {
  //     throw new Error('Topic is required');
  //   }

  //   const job = await this.pptQueue.add('generate-ppt', { topic, sessionId });
  //   return {
  //     jobId: job.id,
  //     sessionId,
  //     message: 'PPT generation task submitted successfully',
  //   };
  // }
}
