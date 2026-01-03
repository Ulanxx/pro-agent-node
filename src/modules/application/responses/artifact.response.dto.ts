import {
  Artifact,
  ArtifactType,
} from '../../database/entities/artifact.entity';

export class ArtifactResponseDto {
  id: string;
  applicationId: string;
  type: ArtifactType;
  title: string | null;
  storagePath: string | null;
  storageUrl: string | null;
  fileSize: number | null;
  metadata: Record<string, any>;
  version: string;
  createdAt: Date;

  static fromEntity(entity: Artifact): ArtifactResponseDto {
    const dto = new ArtifactResponseDto();
    dto.id = entity.id;
    dto.applicationId = entity.applicationId;
    dto.type = entity.type;
    dto.title = entity.title;
    dto.storagePath = entity.storagePath;
    dto.storageUrl = entity.storageUrl;
    dto.fileSize = entity.fileSize;
    dto.metadata = entity.metadata;
    dto.version = entity.version;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
