import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface VideoFormat {
  formatId: string;
  extension: string;
  resolution?: string;
  filesize?: number;
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  videoId!: string;

  @Column()
  title!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string;

  @Column()
  url!: string;

  @Column('float')
  duration!: number;

  @Column({ nullable: true })
  thumbnail!: string;

  @Column('jsonb')
  formats!: VideoFormat[];

  @Column()
  filePath!: string;

  @Column()
  fileHash!: string;

  @CreateDateColumn()
  downloadDate!: Date;

  @UpdateDateColumn()
  @Index()
  lastAccessed!: Date;

  @Column({ default: 1 })
  downloadCount!: number;

  @Column({ default: 0 })
  accessCount!: number;
}
