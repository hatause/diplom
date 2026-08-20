import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { SALT_ROUNDS } from '../config/constants.js';
import { ApiError } from '../utils/api-error.js';
import { generateAccessToken, generateRefreshToken, type JwtPayload } from '../plugins/auth.js';
import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: Role;
    groupCode?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw ApiError.conflict('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'STUDENT',
        studentProfile: data.role === 'STUDENT' || !data.role ? {
          create: {
            group: data.groupCode ? {
              connectOrCreate: {
                where: { code: data.groupCode },
                create: { name: data.groupCode, code: data.groupCode },
              },
            } : undefined,
          },
        } : undefined,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    const tokens = await this.createTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, ...tokens };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) throw ApiError.unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized('Invalid credentials');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { passwordHash: _, ...safeUser } = user;
    const tokens = await this.createTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { user: safeUser, ...tokens };
  }

  async refresh(refreshToken: string) {
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw ApiError.unauthorized('Invalid refresh token');
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as JwtPayload;
    } catch {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw ApiError.unauthorized('Invalid refresh token');
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) throw ApiError.unauthorized('User not found');

    return this.createTokens({ userId: user.id, email: user.email, role: user.role });
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        avatarUrl: true, createdAt: true, lastLoginAt: true,
        studentProfile: {
          include: { group: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; avatarUrl?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw ApiError.badRequest('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async createTokens(payload: JwtPayload) {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: payload.userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
