import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ApplicationStatus {
  CREATED = 'created',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum InputType {
  TEXT = 'text',
  FILE = 'file',
  URL = 'url',
}

@Entity('applications')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', length: 64 })
  userId: string;

  @Column({ name: 'title', length: 255, nullable: true })
  title: string;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.CREATED,
  })
  status: ApplicationStatus;

  @Column({
    type: 'enum',
    enum: InputType,
    name: 'input_type',
  })
  inputType: InputType;

  @Column({ name: 'input_content', type: 'text', nullable: true })
  inputContent: string;

  @Column({ name: 'file_metadata', type: 'json', nullable: true })
  fileMetadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
