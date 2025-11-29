import {
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  IsEthereumAddress,
} from 'class-validator';

export class SubmitProofDto {
  @IsObject()
  @IsNotEmpty()
  proof: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'walletAddress must be a valid Ethereum address',
  })
  walletAddress: string;
}
