import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { DomainException } from '../../common/domain.exception';
import { ErrorCodes } from '../../common/codes';
import { PrismaService } from '../../prisma/prisma.service';

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  token_type: 'Bearer';
};

export type AccessTokenOnly = {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private accessTtlSeconds(): number {
    return Number(this.config.getOrThrow<string>('ACCESS_TTL'));
  }

  private refreshTtlSeconds(): number {
    return Number(this.config.getOrThrow<string>('REFRESH_TTL'));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issuePair(
    userId: string,
    deviceId: string,
    email: string,
  ): Promise<TokenPair> {
    const expiresIn = this.accessTtlSeconds();
    const refreshExpiresIn = this.refreshTtlSeconds();

    const access_token = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn,
      },
    );

    const refresh_token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(refresh_token);

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        deviceId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
      },
    });

    return {
      access_token,
      refresh_token,
      expires_in: expiresIn,
      refresh_token_expires_in: refreshExpiresIn,
      token_type: 'Bearer',
    };
  }

  async refreshAccessToken(
    refreshToken: string,
    deviceId: string,
  ): Promise<AccessTokenOnly> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        deviceId,
        revokedAt: null,
      },
      include: { user: true },
    });

    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw new DomainException(ErrorCodes.TOKEN_EXPIRED, 401);
    }

    const expiresIn = this.accessTtlSeconds();
    const access_token = await this.jwt.signAsync(
      { sub: stored.userId, email: stored.user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn,
      },
    );

    return {
      access_token,
      expires_in: expiresIn,
      token_type: 'Bearer',
    };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
