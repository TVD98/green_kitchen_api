import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthProvider, User } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createEmailUser(email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        provider: AuthProvider.email,
      },
    });
  }

  async incrementFailedLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
  }

  async lockAccount(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isLocked: true },
    });
  }

  async resetFailedLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0 },
    });
  }
}
