import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  /**
   * 缓存应用状态
   * @param applicationId 应用 ID
   * @param status 状态数据
   * @param ttl 过期时间（秒），默认 1 小时
   */
  async cacheApplicationState(
    applicationId: string,
    status: any,
    ttl: number = 3600,
  ): Promise<void> {
    const key = `app:state:${applicationId}`;
    await this.redis.setex(key, ttl, JSON.stringify(status));
    this.logger.debug(`Cached application state: ${key}`);
  }

  /**
   * 获取应用状态
   * @param applicationId 应用 ID
   * @returns 状态数据
   */
  async getApplicationState(applicationId: string): Promise<any | null> {
    const key = `app:state:${applicationId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 缓存消息历史
   * @param applicationId 应用 ID
   * @param messages 消息列表
   * @param ttl 过期时间（秒），默认 24 小时
   */
  async cacheMessages(
    applicationId: string,
    messages: any[],
    ttl: number = 86400,
  ): Promise<void> {
    const key = `app:messages:${applicationId}`;
    const pipeline = this.redis.pipeline();
    pipeline.del(key);
    messages.forEach((msg) => {
      pipeline.rpush(key, JSON.stringify(msg));
    });
    pipeline.expire(key, ttl);
    await pipeline.exec();
    this.logger.debug(
      `Cached ${messages.length} messages for application: ${applicationId}`,
    );
  }

  /**
   * 获取消息历史
   * @param applicationId 应用 ID
   * @returns 消息列表
   */
  async getMessages(applicationId: string): Promise<any[]> {
    const key = `app:messages:${applicationId}`;
    const messages = await this.redis.lrange(key, 0, -1);
    return messages.map((msg) => JSON.parse(msg));
  }

  /**
   * 缓存 artifact 索引
   * @param applicationId 应用 ID
   * @param artifactIds artifact ID 列表
   * @param ttl 过期时间（秒），默认 1 小时
   */
  async cacheArtifactIndexes(
    applicationId: string,
    artifactIds: string[],
    ttl: number = 3600,
  ): Promise<void> {
    const key = `app:artifacts:${applicationId}`;
    const pipeline = this.redis.pipeline();
    pipeline.del(key);
    artifactIds.forEach((id) => {
      pipeline.sadd(key, id);
    });
    pipeline.expire(key, ttl);
    await pipeline.exec();
    this.logger.debug(
      `Cached ${artifactIds.length} artifacts for application: ${applicationId}`,
    );
  }

  /**
   * 获取 artifact 索引
   * @param applicationId 应用 ID
   * @returns artifact ID 列表
   */
  async getArtifactIndexes(applicationId: string): Promise<string[]> {
    const key = `app:artifacts:${applicationId}`;
    return await this.redis.smembers(key);
  }

  /**
   * 删除缓存
   * @param pattern 模式（支持通配符）
   */
  async deleteCache(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.debug(
        `Deleted cache for pattern: ${pattern}, count: ${keys.length}`,
      );
    }
  }

  /**
   * 删除应用相关的所有缓存
   * @param applicationId 应用 ID
   */
  async deleteApplicationCache(applicationId: string): Promise<void> {
    await Promise.all([
      this.deleteCache(`app:state:${applicationId}`),
      this.deleteCache(`app:messages:${applicationId}`),
      this.deleteCache(`app:artifacts:${applicationId}`),
    ]);
    this.logger.debug(`Deleted all cache for application: ${applicationId}`);
  }

  /**
   * 保存消息（追加到历史）
   * @param applicationId 应用 ID
   * @param message 消息
   * @param ttl 过期时间（秒），默认 24 小时
   */
  async saveMessage(
    applicationId: string,
    message: any,
    ttl: number = 86400,
  ): Promise<void> {
    const key = `app:messages:${applicationId}`;
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.expire(key, ttl);
    this.logger.debug(`Saved message for application: ${applicationId}`);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
