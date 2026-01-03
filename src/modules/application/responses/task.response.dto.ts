import { Task, TaskStatus } from '../../database/entities/task.entity';

export class TaskResponseDto {
  id: string;
  applicationId: string;
  parentTaskId: string;
  name: string;
  description: string;
  status: TaskStatus;
  taskType: string;
  metadata: Record<string, any>;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;

  static fromEntity(entity: Task): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = entity.id;
    dto.applicationId = entity.applicationId;
    dto.parentTaskId = entity.parentTaskId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.taskType = entity.taskType;
    dto.metadata = entity.metadata;
    dto.startedAt = entity.startedAt;
    dto.completedAt = entity.completedAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
