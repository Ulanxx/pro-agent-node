import { Module, forwardRef } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { AgentModule } from '../agent/agent.module';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [forwardRef(() => AgentModule), ApplicationModule],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
