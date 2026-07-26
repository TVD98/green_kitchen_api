import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,32}$/;

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  reset_token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(PASSWORD_REGEX, {
    message:
      'new_password must be 8-32 chars with upper, lower, digit, and special (!@#$%^&*)',
  })
  new_password!: string;
}
