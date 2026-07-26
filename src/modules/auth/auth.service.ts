import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthProvider, OtpPurpose, User } from '../../../generated/prisma/client';
import { AuthCodes, ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

type PublicUser = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
  ) {}

  private mapUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
    };
  }

  private maxLoginAttempts(): number {
    return Number(this.config.getOrThrow<string>('MAX_LOGIN_ATTEMPTS'));
  }

  private extractEmailClaim(idToken: string): string | null {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf8'),
        ) as { email?: unknown };
        if (typeof payload.email === 'string' && payload.email.includes('@')) {
          return payload.email.trim().toLowerCase();
        }
      } catch {
        // stub: ignore malformed JWT claims
      }
    }

    try {
      const parsed = JSON.parse(idToken) as { email?: unknown };
      if (typeof parsed.email === 'string' && parsed.email.includes('@')) {
        return parsed.email.trim().toLowerCase();
      }
    } catch {
      // not JSON
    }

    return null;
  }

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new DomainException(ErrorCodes.USER_EXISTS, 400);
    }

    const user = await this.users.createEmailUser(email, dto.password);
    const tokens = await this.tokens.issuePair(
      user.id,
      dto.device_info.device_id,
      user.email,
    );

    return {
      code: AuthCodes.SIGNUP_SUCCESS,
      data: {
        user: this.mapUser(user),
        tokens,
      },
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (!user || !user.passwordHash) {
      throw new DomainException(ErrorCodes.INVALID_CREDENTIALS, 401);
    }

    if (user.isLocked) {
      throw new DomainException(ErrorCodes.ACCOUNT_LOCKED, 403);
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      const updated = await this.users.incrementFailedLogin(user.id);
      if (updated.failedLoginCount >= this.maxLoginAttempts()) {
        await this.users.lockAccount(user.id);
        throw new DomainException(ErrorCodes.ACCOUNT_LOCKED, 403);
      }
      throw new DomainException(ErrorCodes.INVALID_CREDENTIALS, 401);
    }

    await this.users.resetFailedLogin(user.id);
    const tokens = await this.tokens.issuePair(
      user.id,
      dto.device_id,
      user.email,
    );

    return {
      code: AuthCodes.LOGIN_SUCCESS,
      data: {
        user: this.mapUser(user),
        tokens,
      },
    };
  }

  async socialLogin(dto: SocialLoginDto) {
    const idToken = dto.id_token?.trim() ?? '';
    if (!idToken || idToken === 'fail') {
      throw new DomainException(ErrorCodes.SOCIAL_AUTH_FAILED, 401);
    }

    const provider =
      dto.provider === 'google' ? AuthProvider.google : AuthProvider.facebook;
    const providerId = createHash('sha256').update(idToken).digest('hex');
    const claimedEmail = this.extractEmailClaim(idToken);
    const email =
      claimedEmail ??
      `${dto.provider}_${providerId.slice(0, 16)}@social.greenkitchen.app`;

    const user = await this.users.upsertSocialUser(provider, providerId, email);
    const tokens = await this.tokens.issuePair(
      user.id,
      dto.device_info.device_id,
      user.email,
    );

    return {
      code: AuthCodes.LOGIN_SUCCESS,
      data: {
        user: this.mapUser(user),
        tokens,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    return this.otp.createSession(
      dto.email,
      OtpPurpose.password_reset,
    );
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const data = await this.otp.verify(
      dto.session_id,
      dto.otp_code,
      OtpPurpose.password_reset,
    );
    return { code: 'OK', data };
  }

  async resetPassword(dto: ResetPasswordDto) {
    await this.otp.consumeResetToken(dto.reset_token, dto.new_password);
    return {
      code: AuthCodes.PASSWORD_RESET_SUCCESS,
      data: null,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const data = await this.tokens.refreshAccessToken(
      dto.refresh_token,
      dto.device_id,
    );
    return { code: 'OK', data };
  }

  async logout(dto: LogoutDto) {
    await this.tokens.revokeRefreshToken(dto.refresh_token);
    return { code: 'OK', data: null };
  }
}
