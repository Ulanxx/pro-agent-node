import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BunnyStorageService } from '../storage/bunny-storage.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileProcessingService {
  private readonly logger = new Logger(FileProcessingService.name);

  // 允许的文件类型
  private readonly allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ];

  // 最大文件大小（10MB）
  private readonly maxFileSize = 10 * 1024 * 1024;

  constructor(private readonly bunnyStorageService: BunnyStorageService) {}

  /**
   * 处理文件上传
   */
  async uploadFile(
    file: Express.Multer.File,
    applicationId: string,
  ): Promise<{
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    storageUrl: string;
  }> {
    this.logger.log(`Processing file upload for application: ${applicationId}`);

    // 验证文件类型
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed: ${file.mimetype}. Allowed types: PDF, Word, PowerPoint, Text`,
      );
    }

    // 验证文件大小
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds limit: ${file.size} bytes (max: ${this.maxFileSize} bytes)`,
      );
    }

    // 生成文件 ID 和路径
    const fileId = uuidv4();
    const fileExtension = this.getFileExtension(file.mimetype);
    const filename = `${fileId}.${fileExtension}`;
    const storagePath = this.bunnyStorageService.generateStoragePath(
      'uploads',
      filename,
    );

    // 上传到 Bunny Storage
    const storageUrl = await this.bunnyStorageService.uploadFile(
      storagePath,
      file.buffer,
      file.mimetype,
    );

    this.logger.log(
      `File uploaded successfully: ${file.originalname} -> ${storageUrl}`,
    );

    return {
      fileId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath,
      storageUrl,
    };
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        'pptx',
      'text/plain': 'txt',
    };

    return mimeToExt[mimeType] || 'bin';
  }
}
