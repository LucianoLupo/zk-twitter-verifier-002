import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import { SubmitProofDto } from './dto/submit-proof.dto';
import { SaveVerificationDto } from './dto/save-verification.dto';

@Controller('api/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  async submitProof(@Body() dto: SubmitProofDto) {
    return this.verificationService.submitAndVerify(dto);
  }

  @Post('save')
  @HttpCode(HttpStatus.OK)
  async saveVerification(@Body() dto: SaveVerificationDto) {
    return this.verificationService.saveVerification(dto);
  }

  @Get('check/:walletAddress')
  async checkVerification(@Param('walletAddress') walletAddress: string) {
    const result = await this.verificationService.checkVerification(walletAddress);

    if (!result) {
      throw new NotFoundException('No verification found for this wallet');
    }

    return result;
  }

  @Get('list')
  async listVerifications() {
    const verifications = await this.verificationService.getAllVerifications();
    return {
      count: verifications.length,
      verifications: verifications.map((v) => ({
        id: v.id,
        walletAddress: v.walletAddress,
        twitterHandle: v.twitterHandle,
        verifiedAt: v.verifiedAt,
      })),
    };
  }

  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
