import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt } from 'crypto';
import { OtpPurpose } from '../../../generated/prisma/client';
import { AuthCodes, ErrorCodes } from '../../common/codes';
import { DomainException } from '../../common/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';

const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  generateOtp(): string {
    return randomInt(0, 10000).toString().padStart(4, '0');
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private ttlSeconds(): number {
    return Number(this.config.getOrThrow<string>('OTP_TTL_SECONDS'));
  }

  private resendSeconds(): number {
    return Number(this.config.getOrThrow<string>('OTP_RESEND_SECONDS'));
  }

  private isDevEnv(): boolean {
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  async createSession(
    email: string,
    purpose: OtpPurpose,
  ): Promise<{
    code: string;
    data: {
      session_id: string;
      expire_in_seconds: number;
      resend_after_seconds: number;
      dev_otp?: string;
    };
  }> {
    const normalized = email.trim().toLowerCase();
    const expireInSeconds = this.ttlSeconds();
    const resendAfterSeconds = this.resendSeconds();
    const user = await this.users.findByEmail(normalized);
    const expiresAt = new Date(Date.now() + expireInSeconds * 1000);

    // Always persist a session so verify behavior cannot enumerate account existence.
    // Unknown emails get an unguessable otpHash and never receive/log a real OTP.
    if (!user) {
      const session = await this.prisma.otpSession.create({
        data: {
          email: normalized,
          otpHash: this.hash(randomBytes(32).toString('hex')),
          purpose,
          expiresAt,
        },
      });

      return {
        code: AuthCodes.OTP_SENT,
        data: {
          session_id: session.id,
          expire_in_seconds: expireInSeconds,
          resend_after_seconds: resendAfterSeconds,
        },
      };
    }

    const otp = this.generateOtp();
    const session = await this.prisma.otpSession.create({
      data: {
        email: normalized,
        otpHash: this.hash(otp),
        purpose,
        expiresAt,
      },
    });

    this.logger.log(`OTP for ${normalized}: ${otp}`);

    return {
      code: AuthCodes.OTP_SENT,
      data: {
        session_id: session.id,
        expire_in_seconds: expireInSeconds,
        resend_after_seconds: resendAfterSeconds,
        ...(this.isDevEnv() ? { dev_otp: otp } : {}),
      },
    };
  }

  async verify(
    sessionId: string,
    otpCode: string,
    purpose: OtpPurpose,
  ): Promise<{ reset_token: string }> {
    const session = await this.prisma.otpSession.findUnique({
      where: { id: sessionId },
    });

    // Missing / wrong-purpose / already-verified OTP → same code as wrong OTP
    // so callers cannot distinguish unknown emails or reused codes by error shape.
    if (
      !session ||
      session.purpose !== purpose ||
      session.resetTokenHash
    ) {
      throw new DomainException(ErrorCodes.INVALID_OTP, 400);
    }

    if (
      session.consumedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.attempts >= MAX_OTP_ATTEMPTS
    ) {
      throw new DomainException(ErrorCodes.OTP_EXPIRED, 400);
    }

    if (session.otpHash !== this.hash(otpCode)) {
      const updated = await this.prisma.otpSession.update({
        where: { id: session.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= MAX_OTP_ATTEMPTS) {
        throw new DomainException(ErrorCodes.OTP_EXPIRED, 400);
      }
      throw new DomainException(ErrorCodes.INVALID_OTP, 400);
    }

    const resetToken = randomBytes(32).toString('hex');
    // Setting resetTokenHash marks OTP as single-use; consumeResetToken still
    // accepts unconsumed sessions that already have resetTokenHash.
    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { resetTokenHash: this.hash(resetToken) },
    });

    return { reset_token: resetToken };
  }

  async consumeResetToken(
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    const resetTokenHash = this.hash(resetToken);
    const session = await this.prisma.otpSession.findFirst({
      where: { resetTokenHash },
    });

    if (!session || !session.resetTokenHash) {
      throw new DomainException(ErrorCodes.INVALID_RESET_TOKEN, 400);
    }

    if (
      session.consumedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new DomainException(ErrorCodes.RESET_TOKEN_EXPIRED, 400);
    }

    const user = await this.users.findByEmail(session.email);
    if (!user) {
      throw new DomainException(ErrorCodes.INVALID_RESET_TOKEN, 400);
    }

    await this.users.updatePassword(user.id, newPassword);
    await this.tokens.revokeAllForUser(user.id);
    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { consumedAt: new Date() },
    });
  }
}
