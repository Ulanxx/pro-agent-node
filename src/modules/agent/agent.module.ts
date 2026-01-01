import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ChatService } from './chat.service';
import { Chat5StageService } from './chat-5-stage.service';
import { PptGraphService } from './graph/ppt-graph.service';
import { ArtifactService } from './artifact.service';
import { SocketModule } from '../socket/socket.module';
import { WebSearchTool } from './tools/web-search.tool';
import { IntentClassifier } from './intent-classifier.service';

@Module({
  imports: [forwardRef(() => SocketModule)],
  providers: [
    AgentService,
    ChatService,
    Chat5StageService,
    PptGraphService,
    ArtifactService,
    WebSearchTool,
    IntentClassifier,
  ],
  exports: [
    AgentService,
    ChatService,
    Chat5StageService,
    PptGraphService,
    ArtifactService,
    WebSearchTool,
    IntentClassifier,
  ],
})
export class AgentModule {}
