import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  session_id!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'otp_code must be exactly 4 digits' })
  otp_code!: string;

  @IsString()
  @IsIn(['password_reset'])
  purpose!: 'password_reset';
}
