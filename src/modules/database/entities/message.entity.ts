import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Application } from './application.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum MessageKind {
  CHAT = 'chat',
  TOOL = 'tool',
}

@Entity('messages')
@Index(['applicationId'])
@Index(['timestamp'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({
    type: 'enum',
    enum: MessageRole,
  })
  role: MessageRole;

  @Column({
    type: 'enum',
    enum: MessageKind,
    default: MessageKind.CHAT,
  })
  kind: MessageKind;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'timestamp', type: 'bigint' })
  timestamp: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;
}
