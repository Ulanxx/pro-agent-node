import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class InputTextDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  content: string;
}
