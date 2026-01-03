import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus } from '../database/entities/task.entity';
import { TaskResponseDto } from './responses';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  /**
   * 创建任务
   */
  async create(
    applicationId: string,
    name: string,
    description?: string,
    taskType?: string,
    parentTaskId?: string,
  ): Promise<TaskResponseDto> {
    this.logger.log(
      `Creating task for application: ${applicationId}, name: ${name}`,
    );

    const task = this.taskRepository.create({
      id: uuidv4(),
      applicationId,
      parentTaskId,
      name,
      description,
      taskType,
      status: TaskStatus.PENDING,
    });

    const saved = await this.taskRepository.save(task);

    this.logger.log(`Task created: ${saved.id}`);
    return TaskResponseDto.fromEntity(saved);
  }

  /**
   * 更新任务状态
   */
  async updateStatus(
    taskId: string,
    status: TaskStatus,
    metadata?: Record<string, any>,
  ): Promise<TaskResponseDto> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task not found: ${taskId}`);
    }

    task.status = status;

    if (status === TaskStatus.IN_PROGRESS && !task.startedAt) {
      task.startedAt = new Date();
    }

    if (
      status === TaskStatus.COMPLETED ||
      status === TaskStatus.FAILED ||
      status === TaskStatus.SKIPPED
    ) {
      task.completedAt = new Date();
    }

    if (metadata) {
      task.metadata = { ...task.metadata, ...metadata };
    }

    const updated = await this.taskRepository.save(task);

    this.logger.log(`Task updated: ${taskId}, status: ${status}`);
    return TaskResponseDto.fromEntity(updated);
  }

  /**
   * 查询任务树
   */
  async findTaskTree(applicationId: string): Promise<TaskResponseDto[]> {
    const tasks = await this.taskRepository.find({
      where: { applicationId },
      order: { createdAt: 'ASC' },
    });

    return tasks.map((t) => TaskResponseDto.fromEntity(t));
  }

  /**
   * 计算任务进度
   */
  async calculateProgress(applicationId: string): Promise<number> {
    const tasks = await this.taskRepository.find({
      where: { applicationId },
    });

    if (tasks.length === 0) {
      return 0;
    }

    const totalWeight = tasks.length;
    const completedWeight = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;

    return Math.round((completedWeight / totalWeight) * 100);
  }
}
