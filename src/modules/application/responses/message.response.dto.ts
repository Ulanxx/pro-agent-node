import {
  Message,
  MessageRole,
  MessageKind,
} from '../../database/entities/message.entity';

export class MessageResponseDto {
  id: string;
  applicationId: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  metadata: Record<string, any>;
  timestamp: number;
  createdAt: Date;

  static fromEntity(entity: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = entity.id;
    dto.applicationId = entity.applicationId;
    dto.role = entity.role;
    dto.kind = entity.kind;
    dto.content = entity.content;
    dto.metadata = entity.metadata;
    dto.timestamp = entity.timestamp;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
