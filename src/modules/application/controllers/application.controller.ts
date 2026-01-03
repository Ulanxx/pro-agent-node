import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApplicationService } from '../application.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  QueryApplicationsDto,
} from '../dto';
import { ApplicationResponseDto } from '../responses';

@Controller('api/applications')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  /**
   * 创建应用
   * POST /api/applications
   */
  @Post()
  async create(
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return await this.applicationService.create(dto);
  }

  /**
   * 获取应用详情
   * GET /api/applications/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApplicationResponseDto> {
    return await this.applicationService.findOne(id);
  }

  /**
   * 查询应用列表
   * GET /api/applications
   */
  @Get()
  async findAll(@Query() dto: QueryApplicationsDto) {
    return await this.applicationService.findAll(dto);
  }

  /**
   * 更新应用状态
   * PATCH /api/applications/:id/status
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return await this.applicationService.updateStatus(id, dto);
  }

  /**
   * 删除应用
   * DELETE /api/applications/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.applicationService.remove(id);
  }
}
