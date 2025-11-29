import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('verifications')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  walletAddress: string;

  @Column()
  twitterHandle: string;

  @Column()
  proofHash: string;

  @Column()
  verifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
