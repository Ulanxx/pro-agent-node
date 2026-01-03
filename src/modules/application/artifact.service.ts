import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Artifact, ArtifactType } from '../database/entities/artifact.entity';
import { ArtifactResponseDto } from './responses';
import { BunnyStorageService } from '../storage/bunny-storage.service';
import { RedisCacheService } from '../storage/redis-cache.service';

@Injectable()
export class ArtifactService {
  private readonly logger = new Logger(ArtifactService.name);

  constructor(
    @InjectRepository(Artifact)
    private readonly artifactRepository: Repository<Artifact>,
    private readonly bunnyStorageService: BunnyStorageService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  /**
   * 创建 artifact 记录并上传文件
   */
  async create(
    applicationId: string,
    type: ArtifactType,
    content: any,
    file?: Buffer,
    title?: string,
  ): Promise<ArtifactResponseDto> {
    this.logger.log(
      `Creating artifact for application: ${applicationId}, type: ${type}`,
    );

    const artifactId = uuidv4();
    let storagePath: string | null = null;
    let storageUrl: string | null = null;
    let fileSize: number | null = null;

    // 如果有文件，上传到 Bunny Storage
    if (file) {
      const extension = this.getFileExtension(type);
      const filename = `${artifactId}.${extension}`;
      storagePath = this.bunnyStorageService.generateStoragePath(
        `artifacts/${type}`,
        filename,
      );

      storageUrl = await this.bunnyStorageService.uploadFile(
        storagePath,
        file,
        this.getContentType(type),
      );
      fileSize = file.length;
    }

    // 创建 artifact 记录
    const artifact = new Artifact();
    artifact.id = artifactId;
    artifact.applicationId = applicationId;
    artifact.type = type;
    artifact.title = title || null;
    artifact.storagePath = storagePath || null;
    artifact.storageUrl = storageUrl || null;
    artifact.fileSize = fileSize || null;
    artifact.metadata = { content };
    artifact.version = '1.0';

    const saved = await this.artifactRepository.save(artifact);

    // 更新缓存
    const cachedArtifacts =
      await this.redisCacheService.getArtifactIndexes(applicationId);
    await this.redisCacheService.cacheArtifactIndexes(applicationId, [
      ...cachedArtifacts,
      artifactId,
    ]);

    this.logger.log(`Artifact created: ${artifactId}`);
    return ArtifactResponseDto.fromEntity(saved);
  }

  /**
   * 查询应用的 artifact 列表
   */
  async findByApplicationId(
    applicationId: string,
  ): Promise<ArtifactResponseDto[]> {
    const artifacts = await this.artifactRepository.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });

    return artifacts.map((a) => ArtifactResponseDto.fromEntity(a));
  }

  /**
   * 获取 artifact 详情
   */
  async findOne(id: string): Promise<ArtifactResponseDto> {
    const artifact = await this.artifactRepository.findOne({
      where: { id },
    });

    if (!artifact) {
      throw new NotFoundException(`Artifact not found: ${id}`);
    }

    return ArtifactResponseDto.fromEntity(artifact);
  }

  /**
   * 删除 artifact
   */
  async remove(id: string): Promise<void> {
    const artifact = await this.artifactRepository.findOne({
      where: { id },
    });

    if (!artifact) {
      throw new NotFoundException(`Artifact not found: ${id}`);
    }

    // 删除存储文件
    if (artifact.storagePath) {
      await this.bunnyStorageService.deleteFile(artifact.storagePath);
    }

    // 删除数据库记录
    await this.artifactRepository.remove(artifact);

    // 清除缓存
    const cachedArtifacts = await this.redisCacheService.getArtifactIndexes(
      artifact.applicationId,
    );
    const filtered = cachedArtifacts.filter((a) => a !== id);
    await this.redisCacheService.cacheArtifactIndexes(
      artifact.applicationId,
      filtered,
    );

    this.logger.log(`Artifact deleted: ${id}`);
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(type: ArtifactType): string {
    const extMap: Record<ArtifactType, string> = {
      [ArtifactType.DSL]: 'json',
      [ArtifactType.PPTX]: 'pptx',
      [ArtifactType.PPT_HTML]: 'html',
      [ArtifactType.PPT_HTML_DOC]: 'json',
      [ArtifactType.COURSE_CONFIG]: 'json',
      [ArtifactType.VIDEO_OUTLINE]: 'json',
      [ArtifactType.SLIDE_SCRIPTS]: 'json',
      [ArtifactType.PRESENTATION_THEME]: 'json',
      [ArtifactType.PLAN]: 'json',
      [ArtifactType.SEARCH_RESULT]: 'json',
      [ArtifactType.WEB_PAGE]: 'json',
      [ArtifactType.REQUIREMENT_ANALYSIS]: 'json',
    };

    return extMap[type] || 'json';
  }

  /**
   * 获取 Content-Type
   */
  private getContentType(type: ArtifactType): string {
    const typeMap: Partial<Record<ArtifactType, string>> = {
      [ArtifactType.PPTX]:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      [ArtifactType.PPT_HTML]: 'text/html',
    };

    return typeMap[type] || 'application/json';
  }
}
