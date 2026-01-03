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

export enum ArtifactType {
  PLAN = 'plan',
  DSL = 'dsl',
  PPT_HTML = 'ppt_html',
  PPT_HTML_DOC = 'ppt_html_doc',
  PPTX = 'pptx',
  SEARCH_RESULT = 'search_result',
  WEB_PAGE = 'web_page',
  REQUIREMENT_ANALYSIS = 'requirement_analysis',
  COURSE_CONFIG = 'course_config',
  VIDEO_OUTLINE = 'video_outline',
  SLIDE_SCRIPTS = 'slide_scripts',
  PRESENTATION_THEME = 'presentation_theme',
}

@Entity('artifacts')
@Index(['applicationId'])
@Index(['type'])
@Index(['createdAt'])
export class Artifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({
    type: 'enum',
    enum: ArtifactType,
  })
  type: ArtifactType;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  title: string | null;

  @Column({
    type: 'varchar',
    name: 'storage_path',
    length: 512,
    nullable: true,
  })
  storagePath: string | null;

  @Column({
    type: 'varchar',
    name: 'storage_url',
    length: 512,
    nullable: true,
  })
  storageUrl: string | null;

  @Column({
    type: 'bigint',
    name: 'file_size',
    nullable: true,
  })
  fileSize: number | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'version', length: 16, default: '1.0' })
  version: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: Application;
}
