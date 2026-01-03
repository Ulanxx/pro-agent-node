import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BunnyStorageService } from './bunny-storage.service';
import { RedisCacheService } from './redis-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [BunnyStorageService, RedisCacheService],
  exports: [BunnyStorageService, RedisCacheService],
})
export class StorageModule {}
