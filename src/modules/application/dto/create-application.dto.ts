import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { InputType } from '../../database/entities/application.entity';

export class CreateApplicationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  userId: string;

  @IsEnum(InputType)
  inputType: InputType;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  inputContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  fileMetadata?: Record<string, any>;
}
