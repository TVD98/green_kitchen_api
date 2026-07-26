import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../../../generated/prisma/client';
import { AuthCodes, ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignupDto } from './dto/signup.dto';
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
