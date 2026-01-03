import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../database/entities/message.entity';
import { MessageResponseDto } from '../responses';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/applications/:id/messages')
export class MessageController {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * 获取消息历史
   * GET /api/applications/:id/messages
   */
  @Get()
  async findMessages(
    @Param('id') applicationId: string,
  ): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.find({
      where: { applicationId },
      order: { timestamp: 'ASC' },
    });

    return messages.map((m) => MessageResponseDto.fromEntity(m));
  }

  /**
   * 发送消息（REST 方式）
   * POST /api/applications/:id/messages
   */
  @Post()
  async sendMessage(
    @Param('id') applicationId: string,
    @Body() dto: { content: string },
  ) {
    // 这里应该调用 ChatService 处理
    // 暂时返回简单的响应
    return {
      applicationId,
      messageId: `msg_${uuidv4()}`,
      status: 'queued',
    };
  }
}
