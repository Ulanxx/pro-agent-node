import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Application,
  ApplicationStatus,
  InputType,
} from '../database/entities/application.entity';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  QueryApplicationsDto,
} from './dto';
import { ApplicationResponseDto, PaginatedResponseDto } from './responses';
import { RedisCacheService } from '../storage/redis-cache.service';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  /**
   * 创建应用
   */
  async create(dto: CreateApplicationDto): Promise<ApplicationResponseDto> {
    this.logger.log(`Creating application for user: ${dto.userId}`);

    const application = this.applicationRepository.create({
      ...dto,
      id: uuidv4(),
      status: ApplicationStatus.CREATED,
    });

    const saved = await this.applicationRepository.save(application);

    // 缓存应用状态
    await this.redisCacheService.cacheApplicationState(saved.id, {
      id: saved.id,
      status: saved.status,
      progress: 0,
    });

    this.logger.log(`Application created: ${saved.id}`);
    return ApplicationResponseDto.fromEntity(saved);
  }

  /**
   * 获取应用详情
   */
  async findOne(id: string): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException(`Application not found: ${id}`);
    }

    return ApplicationResponseDto.fromEntity(application);
  }

  /**
   * 查询应用列表（分页）
   */
  async findAll(
    dto?: QueryApplicationsDto,
  ): Promise<PaginatedResponseDto<ApplicationResponseDto>> {
    const { userId, status, page = 1, pageSize = 20 } = dto || {};

    const queryBuilder = this.applicationRepository
      .createQueryBuilder('app')
      .orderBy('app.createdAt', 'DESC');

    if (userId) {
      queryBuilder.andWhere('app.userId = :userId', { userId });
    }

    if (status) {
      queryBuilder.andWhere('app.status = :status', { status });
    }

    const [items, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const responseItems = items.map((item) =>
      ApplicationResponseDto.fromEntity(item),
    );

    return PaginatedResponseDto.create(total, page, pageSize, responseItems);
  }

  /**
   * 更新应用状态
   */
  async updateStatus(
    id: string,
    dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException(`Application not found: ${id}`);
    }

    if (dto.status) {
      application.status = dto.status;
    }

    if (dto.title) {
      application.title = dto.title;
    }

    const updated = await this.applicationRepository.save(application);

    // 更新缓存
    await this.redisCacheService.cacheApplicationState(updated.id, {
      id: updated.id,
      status: updated.status,
      progress: this.calculateProgress(updated.status),
    });

    this.logger.log(`Application updated: ${id}, status: ${updated.status}`);
    return ApplicationResponseDto.fromEntity(updated);
  }

  /**
   * 删除应用（软删除）
   */
  async remove(id: string): Promise<void> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException(`Application not found: ${id}`);
    }

    await this.applicationRepository.remove(application);

    // 清除缓存
    await this.redisCacheService.deleteApplicationCache(id);

    this.logger.log(`Application deleted: ${id}`);
  }

  /**
   * 根据状态计算进度
   */
  private calculateProgress(status: ApplicationStatus): number {
    switch (status) {
      case ApplicationStatus.CREATED:
        return 0;
      case ApplicationStatus.PROCESSING:
        return 50;
      case ApplicationStatus.COMPLETED:
        return 100;
      case ApplicationStatus.FAILED:
        return 0;
      default:
        return 0;
    }
  }
}
