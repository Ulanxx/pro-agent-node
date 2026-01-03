import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Application } from '../database/entities/application.entity';
import { Message } from '../database/entities/message.entity';
import { Artifact } from '../database/entities/artifact.entity';
import { Task } from '../database/entities/task.entity';
import { ApplicationService } from './application.service';
import { FileProcessingService } from './file-processing.service';
import { UrlParsingService } from './url-parsing.service';
import { ArtifactService } from './artifact.service';
import { TaskService } from './task.service';
import { ApplicationController } from './controllers/application.controller';
import { InputProcessingController } from './controllers/input-processing.controller';
import { GenerationController } from './controllers/generation.controller';
import { ArtifactController } from './controllers/artifact.controller';
import { MessageController } from './controllers/message.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Message, Artifact, Task]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [
    ApplicationController,
    InputProcessingController,
    GenerationController,
    ArtifactController,
    MessageController,
  ],
  providers: [
    ApplicationService,
    FileProcessingService,
    UrlParsingService,
    ArtifactService,
    TaskService,
  ],
  exports: [
    ApplicationService,
    FileProcessingService,
    UrlParsingService,
    ArtifactService,
    TaskService,
  ],
})
export class ApplicationModule {}
