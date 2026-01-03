import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ArtifactService } from '../artifact.service';
import { ArtifactResponseDto } from '../responses';

@Controller('api')
export class ArtifactController {
  constructor(private readonly artifactService: ArtifactService) {}

  /**
   * 获取应用的 artifact 列表
   * GET /api/applications/:id/artifacts
   */
  @Get('applications/:id/artifacts')
  async findByApplicationId(
    @Param('id') applicationId: string,
  ): Promise<ArtifactResponseDto[]> {
    return await this.artifactService.findByApplicationId(applicationId);
  }

  /**
   * 获取 artifact 详情
   * GET /api/artifacts/:id
   */
  @Get('artifacts/:id')
  async findOne(@Param('id') id: string): Promise<ArtifactResponseDto> {
    return await this.artifactService.findOne(id);
  }

  /**
   * 下载 artifact
   * GET /api/artifacts/:id/download
   */
  @Get('artifacts/:id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const artifact = await this.artifactService.findOne(id);

    if (!artifact.storageUrl) {
      throw new NotFoundException('Artifact file not found');
    }

    // 重定向到 Bunny CDN URL
    return res.redirect(artifact.storageUrl);
  }

  /**
   * 删除 artifact
   * DELETE /api/artifacts/:id
   */
  @Delete('artifacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.artifactService.remove(id);
  }
}
