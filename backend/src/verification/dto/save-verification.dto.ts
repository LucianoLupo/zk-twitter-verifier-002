import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SaveVerificationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'walletAddress must be a valid Ethereum address',
  })
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  twitterHandle: string;

  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
