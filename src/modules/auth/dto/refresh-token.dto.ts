import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;

  @IsString()
  @IsNotEmpty()
  device_id!: string;
}
