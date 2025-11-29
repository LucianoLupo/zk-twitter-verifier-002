import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

export type QuestStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type QuestType = 'profile' | 'authorship' | 'engagement';

@Entity('quest_completions')
@Unique(['user', 'questNumber'])
export class QuestCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.questCompletions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column()
  @Index()
  questNumber: number; // 1, 2, or 3

  @Column({ default: 'pending' })
  status: QuestStatus;

  @Column()
  questType: QuestType; // 'profile', 'authorship', 'engagement'

  @Column({ nullable: true })
  proofHash: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    tweetId?: string;
    tweetUrl?: string;
    tweetText?: string;
    authorHandle?: string;
    likeVerified?: boolean;
    retweetVerified?: boolean;
  };

  @Column({ type: 'simple-json', nullable: true })
  verificationResult: Record<string, unknown>;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
