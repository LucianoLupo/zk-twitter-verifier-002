import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { Verification } from '../database/entities/verification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Verification]),
    HttpModule.register({
      timeout: 30000, // 30 second timeout for Rust verifier
    }),
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
