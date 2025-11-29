import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';

export class SubmitQuestDto {
  @IsNumber()
  @Min(1)
  @Max(3)
  questNumber: number;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsObject()
  @IsNotEmpty()
  proof: {
    version: string;
    data: string;
    meta: {
      notaryUrl: string;
      websocketProxyUrl?: string;
    };
  };

  @IsOptional()
  @IsString()
  tweetUrl?: string;

  // Wallet signature verification
  @IsString()
  @IsNotEmpty()
  signature: string; // The signed message

  @IsString()
  @IsNotEmpty()
  message: string; // The original message that was signed

  @IsNumber()
  @IsNotEmpty()
  timestamp: number; // Timestamp to prevent replay attacks
}
