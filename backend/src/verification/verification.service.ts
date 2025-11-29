import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { Verification } from '../database/entities/verification.entity';
import { SubmitProofDto } from './dto/submit-proof.dto';
import { SaveVerificationDto } from './dto/save-verification.dto';

interface RustVerifierResponse {
  valid: boolean;
  twitter_handle?: string;
  error?: string;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly RUST_VERIFIER_URL =
    process.env.RUST_VERIFIER_URL || 'http://localhost:8080';

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Verification)
    private verificationRepo: Repository<Verification>,
  ) {}

  async submitAndVerify(dto: SubmitProofDto): Promise<{
    success: boolean;
    handle?: string;
    verificationId?: string;
    message?: string;
  }> {
    const normalizedWallet = dto.walletAddress.toLowerCase();

    // Check if wallet already verified
    const existing = await this.verificationRepo.findOne({
      where: { walletAddress: normalizedWallet },
    });

    if (existing) {
      return {
        success: true,
        handle: existing.twitterHandle,
        verificationId: existing.id,
        message: 'Already verified',
      };
    }

    // Call Rust verifier service
    try {
      this.logger.log(`Sending proof to Rust verifier at ${this.RUST_VERIFIER_URL}`);

      const response = await firstValueFrom(
        this.httpService.post<RustVerifierResponse>(
          `${this.RUST_VERIFIER_URL}/verify`,
          { proof: dto.proof },
        ),
      );

      const { valid, twitter_handle, error } = response.data;

      if (!valid) {
        this.logger.warn(`Proof verification failed: ${error}`);
        return {
          success: false,
          message: error || 'Proof verification failed',
        };
      }

      if (!twitter_handle) {
        return {
          success: false,
          message: 'Could not extract Twitter handle from proof',
        };
      }

      // Check if this Twitter handle was already used
      const existingTwitter = await this.verificationRepo.findOne({
        where: { twitterHandle: twitter_handle },
      });

      if (existingTwitter) {
        return {
          success: false,
          message: 'This Twitter account has already been verified with another wallet',
        };
      }

      // Store the verification
      const proofHash = createHash('sha256')
        .update(JSON.stringify(dto.proof))
        .digest('hex');

      const verification = this.verificationRepo.create({
        walletAddress: normalizedWallet,
        twitterHandle: twitter_handle,
        proofHash,
        verifiedAt: new Date(),
      });

      const saved = await this.verificationRepo.save(verification);

      this.logger.log(
        `Successfully verified @${twitter_handle} for wallet ${normalizedWallet}`,
      );

      return {
        success: true,
        handle: twitter_handle,
        verificationId: saved.id,
      };
    } catch (error) {
      this.logger.error('Verification service error:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Verification service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async checkVerification(walletAddress: string): Promise<{
    verified: boolean;
    twitterHandle?: string;
    verifiedAt?: Date;
  } | null> {
    const verification = await this.verificationRepo.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!verification) {
      return null;
    }

    return {
      verified: true,
      twitterHandle: verification.twitterHandle,
      verifiedAt: verification.verifiedAt,
    };
  }

  async getAllVerifications(): Promise<Verification[]> {
    return this.verificationRepo.find({
      order: { verifiedAt: 'DESC' },
    });
  }

  // Save verification that was already verified by demo.tlsnotary.org
  async saveVerification(dto: SaveVerificationDto): Promise<{
    success: boolean;
    handle?: string;
    verificationId?: string;
    message?: string;
  }> {
    const normalizedWallet = dto.walletAddress.toLowerCase();

    // Check if wallet already verified
    const existingWallet = await this.verificationRepo.findOne({
      where: { walletAddress: normalizedWallet },
    });

    if (existingWallet) {
      return {
        success: true,
        handle: existingWallet.twitterHandle,
        verificationId: existingWallet.id,
        message: 'Already verified',
      };
    }

    // Check if this Twitter handle was already used
    const existingTwitter = await this.verificationRepo.findOne({
      where: { twitterHandle: dto.twitterHandle },
    });

    if (existingTwitter) {
      return {
        success: false,
        message: 'This Twitter account has already been verified with another wallet',
      };
    }

    // Store the verification
    const verification = this.verificationRepo.create({
      walletAddress: normalizedWallet,
      twitterHandle: dto.twitterHandle,
      proofHash: createHash('sha256').update(dto.sessionId).digest('hex'),
      verifiedAt: new Date(),
    });

    const saved = await this.verificationRepo.save(verification);

    this.logger.log(
      `Saved verification: @${dto.twitterHandle} for wallet ${normalizedWallet}`,
    );

    return {
      success: true,
      handle: dto.twitterHandle,
      verificationId: saved.id,
    };
  }
}
