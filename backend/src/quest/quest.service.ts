import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { verifyMessage } from 'viem';
import { User } from '../database/entities/user.entity';
import { QuestCompletion, QuestType, QuestStatus } from '../database/entities/quest-completion.entity';
import { SubmitQuestDto } from './dto/submit-quest.dto';

// Signature validity window (5 minutes)
const SIGNATURE_VALIDITY_MS = 5 * 60 * 1000;

interface RustVerifierResponse {
  valid: boolean;
  twitter_handle?: string;
  tweet_id?: string;
  author_screen_name?: string;
  tweet_text?: string;
  like_verified?: boolean;
  retweet_verified?: boolean;
  error?: string;
}

const QUEST_CONFIG: Record<number, { type: QuestType; name: string; prerequisites: number[] }> = {
  1: { type: 'profile', name: 'Verify Twitter Profile', prerequisites: [] },
  2: { type: 'authorship', name: 'Verify Tweet Authorship', prerequisites: [1] },
  3: { type: 'engagement', name: 'Verify Like & Retweet', prerequisites: [1] },
};

@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);
  private readonly RUST_VERIFIER_URL =
    process.env.RUST_VERIFIER_URL || 'http://localhost:8080';

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(QuestCompletion)
    private questCompletionRepo: Repository<QuestCompletion>,
  ) {}

  async getOrCreateUser(walletAddress: string): Promise<User> {
    const normalized = walletAddress.toLowerCase();
    let user = await this.userRepo.findOne({
      where: { walletAddress: normalized },
    });

    if (!user) {
      user = this.userRepo.create({ walletAddress: normalized });
      user = await this.userRepo.save(user);
      this.logger.log(`Created new user for wallet ${normalized}`);
    }

    return user;
  }

  async getUserProgress(walletAddress: string): Promise<{
    walletAddress: string;
    twitterHandle?: string;
    quests: Array<{
      number: number;
      name: string;
      type: QuestType;
      status: QuestStatus | 'locked';
      completedAt?: Date;
      metadata?: Record<string, unknown>;
    }>;
  }> {
    const normalized = walletAddress.toLowerCase();
    const user = await this.userRepo.findOne({
      where: { walletAddress: normalized },
      relations: ['questCompletions'],
    });

    const completions = user?.questCompletions || [];
    const completedQuests = new Set(
      completions.filter(q => q.status === 'completed').map(q => q.questNumber)
    );

    const quests = [1, 2, 3].map(num => {
      const config = QUEST_CONFIG[num];
      const completion = completions.find(c => c.questNumber === num);

      // Check prerequisites
      const prerequisitesMet = config.prerequisites.every(p => completedQuests.has(p));

      let status: QuestStatus | 'locked';
      if (completion) {
        status = completion.status;
      } else if (prerequisitesMet) {
        status = 'pending';
      } else {
        status = 'locked';
      }

      return {
        number: num,
        name: config.name,
        type: config.type,
        status,
        completedAt: completion?.completedAt,
        metadata: completion?.metadata,
      };
    });

    return {
      walletAddress: normalized,
      twitterHandle: user?.twitterHandle,
      quests,
    };
  }

  /**
   * Verify wallet signature to ensure the sender controls the wallet
   */
  async verifyWalletSignature(
    walletAddress: string,
    signature: string,
    message: string,
    timestamp: number,
  ): Promise<{ valid: boolean; error?: string }> {
    // Check timestamp is within validity window
    const now = Date.now();
    if (Math.abs(now - timestamp) > SIGNATURE_VALIDITY_MS) {
      return { valid: false, error: 'Signature expired. Please try again.' };
    }

    // Expected message format
    const expectedMessage = `LupoVerify Quest Submission\nWallet: ${walletAddress.toLowerCase()}\nTimestamp: ${timestamp}`;

    if (message !== expectedMessage) {
      return { valid: false, error: 'Invalid message format' };
    }

    try {
      // Verify the signature using viem
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return { valid: false, error: 'Invalid signature' };
      }

      this.logger.log(`Wallet signature verified for ${walletAddress}`);
      return { valid: true };
    } catch (error) {
      this.logger.error('Signature verification error:', error);
      return { valid: false, error: 'Signature verification failed' };
    }
  }

  async submitQuest(dto: SubmitQuestDto): Promise<{
    success: boolean;
    questNumber: number;
    status: QuestStatus;
    message?: string;
    verificationResult?: Record<string, unknown>;
  }> {
    const { questNumber, walletAddress, proof, tweetUrl, signature, message, timestamp } = dto;
    const normalized = walletAddress.toLowerCase();
    const questConfig = QUEST_CONFIG[questNumber];

    if (!questConfig) {
      throw new HttpException('Invalid quest number', HttpStatus.BAD_REQUEST);
    }

    // Verify wallet signature first
    const signatureResult = await this.verifyWalletSignature(
      walletAddress,
      signature,
      message,
      timestamp,
    );

    if (!signatureResult.valid) {
      return {
        success: false,
        questNumber,
        status: 'failed',
        message: signatureResult.error || 'Wallet signature verification failed',
      };
    }

    // Get or create user
    const user = await this.getOrCreateUser(normalized);

    // Check prerequisites
    const completedQuests = await this.questCompletionRepo.find({
      where: { userId: user.id, status: 'completed' },
    });
    const completedNumbers = new Set(completedQuests.map(q => q.questNumber));

    for (const prereq of questConfig.prerequisites) {
      if (!completedNumbers.has(prereq)) {
        return {
          success: false,
          questNumber,
          status: 'failed',
          message: `Must complete Quest ${prereq} first`,
        };
      }
    }

    // Check if already completed
    const existingCompletion = await this.questCompletionRepo.findOne({
      where: { userId: user.id, questNumber },
    });

    if (existingCompletion?.status === 'completed') {
      return {
        success: true,
        questNumber,
        status: 'completed',
        message: 'Quest already completed',
        verificationResult: existingCompletion.verificationResult,
      };
    }

    // Quest 2 and 3 require tweet URL
    if ((questNumber === 2 || questNumber === 3) && !tweetUrl) {
      return {
        success: false,
        questNumber,
        status: 'failed',
        message: 'Tweet URL is required for this quest',
      };
    }

    // Call Rust verifier
    try {
      this.logger.log(`Verifying quest ${questNumber} for wallet ${normalized}`);

      const response = await firstValueFrom(
        this.httpService.post<RustVerifierResponse>(
          `${this.RUST_VERIFIER_URL}/verify`,
          {
            proof,
            questType: questConfig.type,
            expectedData: questNumber === 2 || questNumber === 3 ? {
              tweetUrl,
              expectedAuthor: user.twitterHandle, // For quest 2, verify author matches
            } : undefined,
          },
        ),
      );

      const verifierResult = response.data;

      if (!verifierResult.valid) {
        this.logger.warn(`Quest ${questNumber} verification failed: ${verifierResult.error}`);
        return {
          success: false,
          questNumber,
          status: 'failed',
          message: verifierResult.error || 'Proof verification failed',
        };
      }

      // Build metadata based on quest type
      const metadata: Record<string, unknown> = {};
      let verificationResult: Record<string, unknown> = {};

      switch (questNumber) {
        case 1: // Profile verification
          if (!verifierResult.twitter_handle) {
            return {
              success: false,
              questNumber,
              status: 'failed',
              message: 'Could not extract Twitter handle',
            };
          }
          // Update user's twitter handle
          user.twitterHandle = verifierResult.twitter_handle;
          await this.userRepo.save(user);
          verificationResult = { twitterHandle: verifierResult.twitter_handle };
          break;

        case 2: // Tweet authorship
          if (verifierResult.author_screen_name?.toLowerCase() !== user.twitterHandle?.toLowerCase()) {
            return {
              success: false,
              questNumber,
              status: 'failed',
              message: `Tweet was not authored by @${user.twitterHandle}`,
            };
          }
          metadata.tweetId = verifierResult.tweet_id;
          metadata.tweetUrl = tweetUrl;
          metadata.tweetText = verifierResult.tweet_text;
          metadata.authorHandle = verifierResult.author_screen_name;
          verificationResult = {
            tweetId: verifierResult.tweet_id,
            authorVerified: true,
          };
          break;

        case 3: // Engagement (like + retweet)
          if (!verifierResult.like_verified || !verifierResult.retweet_verified) {
            const missing = [];
            if (!verifierResult.like_verified) missing.push('like');
            if (!verifierResult.retweet_verified) missing.push('retweet');
            return {
              success: false,
              questNumber,
              status: 'failed',
              message: `Missing engagement: ${missing.join(', ')}`,
            };
          }
          metadata.tweetId = verifierResult.tweet_id;
          metadata.tweetUrl = tweetUrl;
          metadata.likeVerified = verifierResult.like_verified;
          metadata.retweetVerified = verifierResult.retweet_verified;
          verificationResult = {
            tweetId: verifierResult.tweet_id,
            likeVerified: true,
            retweetVerified: true,
          };
          break;
      }

      // Create or update completion
      const proofHash = createHash('sha256')
        .update(JSON.stringify(proof))
        .digest('hex');

      let completion = existingCompletion;
      if (!completion) {
        completion = this.questCompletionRepo.create({
          userId: user.id,
          questNumber,
          questType: questConfig.type,
        });
      }

      completion.status = 'completed';
      completion.proofHash = proofHash;
      completion.metadata = metadata;
      completion.verificationResult = verificationResult;
      completion.completedAt = new Date();

      await this.questCompletionRepo.save(completion);

      this.logger.log(`Quest ${questNumber} completed for wallet ${normalized}`);

      return {
        success: true,
        questNumber,
        status: 'completed',
        verificationResult,
      };
    } catch (error) {
      this.logger.error(`Quest ${questNumber} verification error:`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Verification service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
