import { IsEnum, IsOptional } from 'class-validator';
import { ApplicationStatus } from '../../database/entities/application.entity';

export class UpdateApplicationDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  title?: string;
}
