import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/api-error.js';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    const cookieToken = request.cookies?.accessToken;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken;

    if (!token) {
      throw ApiError.unauthorized('No token provided');
    }

    const payload = verifyToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true, role: true },
    });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    request.user = payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Authentication failed');
  }
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (!request.user || !roles.includes(request.user.role)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
  };
}
