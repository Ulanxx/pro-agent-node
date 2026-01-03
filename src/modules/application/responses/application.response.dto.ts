import {
  Application,
  ApplicationStatus,
  InputType,
} from '../../database/entities/application.entity';

export class ApplicationResponseDto {
  id: string;
  userId: string;
  title: string;
  status: ApplicationStatus;
  inputType: InputType;
  inputContent: string;
  fileMetadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: Application): ApplicationResponseDto {
    const dto = new ApplicationResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.title = entity.title;
    dto.status = entity.status;
    dto.inputType = entity.inputType;
    dto.inputContent = entity.inputContent;
    dto.fileMetadata = entity.fileMetadata;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
