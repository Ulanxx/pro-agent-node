import {
  Controller,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileProcessingService } from '../file-processing.service';
import { UrlParsingService } from '../url-parsing.service';
import { InputTextDto, ParseUrlDto, UploadFileDto } from '../dto';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/applications/:id')
export class InputProcessingController {
  constructor(
    private readonly fileProcessingService: FileProcessingService,
    private readonly urlParsingService: UrlParsingService,
  ) {}

  /**
   * 上传文件
   * POST /api/applications/:id/upload-file
   */
  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id') applicationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return await this.fileProcessingService.uploadFile(file, applicationId);
  }

  /**
   * 解析 URL
   * POST /api/applications/:id/parse-url
   */
  @Post('parse-url')
  async parseUrl(@Param('id') applicationId: string, @Body() dto: ParseUrlDto) {
    return await this.urlParsingService.parseUrl(dto.url);
  }

  /**
   * 提交文本输入
   * POST /api/applications/:id/input-text
   */
  @Post('input-text')
  async inputText(
    @Param('id') applicationId: string,
    @Body() dto: InputTextDto,
  ) {
    // 这里可以触发 ChatService 处理
    return {
      applicationId,
      messageId: `msg_${uuidv4()}`,
      status: 'received',
      content: dto.content,
    };
  }
}
