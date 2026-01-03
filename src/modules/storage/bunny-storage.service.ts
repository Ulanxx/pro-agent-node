import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class BunnyStorageService {
  private readonly logger = new Logger(BunnyStorageService.name);
  private readonly httpClient: AxiosInstance;
  private readonly storageZone: string;
  private readonly hostname: string;
  private readonly accessKey: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.storageZone = this.configService.get<string>('BUNNY_STORAGE_ZONE')!;
    this.hostname = this.configService.get<string>('BUNNY_STORAGE_HOSTNAME')!;
    this.accessKey = this.configService.get<string>(
      'BUNNY_STORAGE_ACCESS_KEY',
    )!;
    this.publicBaseUrl = this.configService.get<string>(
      'BUNNY_PUBLIC_BASE_URL',
    )!;

    this.httpClient = axios.create({
      baseURL: `https://${this.hostname}/${this.storageZone}`,
      headers: {
        AccessKey: this.accessKey,
        'Content-Type': 'application/octet-stream',
      },
    });
  }

  /**
   * 上传文件到 Bunny Storage
   * @param path 文件路径（如：uploads/2024/01/01/file-uuid.pdf）
   * @param buffer 文件内容
   * @param contentType MIME 类型
   * @returns 公共 CDN URL
   */
  async uploadFile(
    path: string,
    buffer: Buffer,
    contentType?: string,
  ): Promise<string> {
    try {
      this.logger.log(`Uploading file to Bunny Storage: ${path}`);

      const headers: Record<string, string> = {
        AccessKey: this.accessKey,
      };

      if (contentType) {
        headers['Content-Type'] = contentType;
      }

      await this.httpClient.put(path, buffer, {
        headers,
      });

      const cdnUrl = this.getPublicUrl(path);
      this.logger.log(`File uploaded successfully: ${cdnUrl}`);

      return cdnUrl;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to Bunny Storage: ${error.message}`,
        error.stack,
      );
      throw new Error(`Bunny Storage upload failed: ${error.message}`);
    }
  }

  /**
   * 删除文件
   * @param path 文件路径
   */
  async deleteFile(path: string): Promise<void> {
    try {
      this.logger.log(`Deleting file from Bunny Storage: ${path}`);

      await this.httpClient.delete(path, {
        headers: {
          AccessKey: this.accessKey,
        },
      });

      this.logger.log(`File deleted successfully: ${path}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete file from Bunny Storage: ${error.message}`,
        error.stack,
      );
      throw new Error(`Bunny Storage delete failed: ${error.message}`);
    }
  }

  /**
   * 获取公共 CDN URL
   * @param storagePath 存储路径
   * @returns 完整的 CDN URL
   */
  getPublicUrl(storagePath: string): string {
    return `https://${this.publicBaseUrl}/${storagePath}`;
  }

  /**
   * 生成存储路径
   * @param type 文件类型（如：uploads, artifacts/pptx 等）
   * @param filename 文件名
   * @returns 完整的存储路径
   */
  generateStoragePath(type: string, filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    if (type === 'uploads') {
      return `${type}/${year}/${month}/${day}/${filename}`;
    }

    return `${type}/${filename}`;
  }
}
