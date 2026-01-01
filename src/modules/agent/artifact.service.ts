import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Artifact } from '../../core/dsl/types';

@Injectable()
export class ArtifactService {
  private readonly logger = new Logger(ArtifactService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async saveArtifact(sessionId: string, artifact: Artifact): Promise<void> {
    const key = `artifacts:${sessionId}`;
    await this.redis.hset(key, artifact.id, JSON.stringify(artifact));
    // Set expiry for session data (e.g., 24 hours)
    await this.redis.expire(key, 86400);
    this.logger.log(`Artifact ${artifact.id} saved for session ${sessionId}`);
  }

  async getArtifacts(sessionId: string): Promise<Artifact[]> {
    const key = `artifacts:${sessionId}`;
    const data = await this.redis.hgetall(key);
    return Object.values(data).map((val) => JSON.parse(val));
  }

  async getArtifact(sessionId: string, artifactId: string): Promise<Artifact | null> {
    const key = `artifacts:${sessionId}`;
    const data = await this.redis.hget(key, artifactId);
    return data ? JSON.parse(data) : null;
  }
}
