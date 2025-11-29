import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { QuestCompletion } from './quest-completion.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  walletAddress: string;

  @Column({ nullable: true })
  @Index()
  twitterHandle: string;

  @OneToMany(() => QuestCompletion, (completion) => completion.user)
  questCompletions: QuestCompletion[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
