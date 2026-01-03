import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class ParseUrlDto {
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  url: string;
}
