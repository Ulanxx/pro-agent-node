import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      entities.Application,
      entities.Message,
      entities.Artifact,
      entities.Task,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
