import { IsEnum, IsOptional } from 'class-validator';

export enum GenerationMode {
  AUTONOMOUS = 'autonomous',
  FIVE_STAGE = '5-stage',
}

export class StartGenerationDto {
  @IsEnum(GenerationMode)
  mode: GenerationMode;

  @IsOptional()
  options?: Record<string, any>;
}
