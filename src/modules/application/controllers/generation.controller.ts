import {
  Controller,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationService } from '../application.service';
import { StartGenerationDto } from '../dto';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/applications/:id')
export class GenerationController {
  constructor(private readonly applicationService: ApplicationService) {}

  /**
   * 开始生成流程
   * POST /api/applications/:id/start
   */
  @Post('start')
  async startGeneration(
    @Param('id') id: string,
    @Body() dto: StartGenerationDto,
  ) {
    // 检查应用是否存在
    const application = await this.applicationService.findOne(id);
    if (!application) {
      throw new NotFoundException(`Application not found: ${id}`);
    }

    // 更新应用状态为处理中
    await this.applicationService.updateStatus(id, {
      status: 'processing' as any,
    });

    // 返回 sessionId（实际应该由 ChatService 或 AgentService 处理）
    const sessionId = uuidv4();

    return {
      applicationId: id,
      status: 'processing',
      sessionId,
      mode: dto.mode,
    };
  }
}
