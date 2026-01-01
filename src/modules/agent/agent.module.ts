import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ChatService } from './chat.service';
import { Chat5StageService } from './chat-5-stage.service';
import { PptGraphService } from './graph/ppt-graph.service';
import { ArtifactService } from './artifact.service';
import { SocketModule } from '../socket/socket.module';
import { WebSearchTool } from './tools/web-search.tool';
import { IntentClassifier } from './intent-classifier.service';
import { PlannerService } from './planner/planner.service';
import { TaskSchedulerService } from './scheduler/task-scheduler.service';
import { TaskExecutorService } from './executor/task-executor.service';
import { ReflectorService } from './reflector/reflector.service';
import { TaskListService } from './task-list/task-list.service';
import { AutonomousGraphService } from './graph/autonomous-graph.service';

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
    PlannerService,
    TaskSchedulerService,
    TaskExecutorService,
    ReflectorService,
    TaskListService,
    AutonomousGraphService,
  ],
  exports: [
    AgentService,
    ChatService,
    Chat5StageService,
    PptGraphService,
    ArtifactService,
    WebSearchTool,
    IntentClassifier,
    PlannerService,
    TaskSchedulerService,
    TaskExecutorService,
    ReflectorService,
    TaskListService,
    AutonomousGraphService,
  ],
})
export class AgentModule {}
