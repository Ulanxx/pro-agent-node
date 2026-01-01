import { Module } from '@nestjs/common';
import { RenderService } from './render.service';
import { PptProcessor } from './ppt.processor';
import { AgentModule } from '../agent/agent.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [AgentModule, SocketModule],
  providers: [RenderService, PptProcessor],
  exports: [RenderService],
})
export class RenderModule {}
