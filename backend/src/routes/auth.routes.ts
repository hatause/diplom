import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service.js';
import { authenticate } from '../plugins/auth.js';
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from '../schemas/index.js';

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = registerSchema.parse(request.body);
    const result = await authService.register(data);

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  });

  // Login
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log('--- LOGIN HEADERS ---', request.headers);
    console.log('--- LOGIN BODY TYPE ---', typeof request.body);
    const { email, password } = loginSchema.parse(request.body);
    const result = await authService.login(email, password);

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  });

  // Refresh
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies?.refreshToken || (request.body as any)?.refreshToken;
    if (!token) return reply.status(401).send({ success: false, error: 'No refresh token' });

    const result = await authService.refresh(token);

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return { success: true, data: { accessToken: result.accessToken } };
  });

  // Logout
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies?.refreshToken || (request.body as any)?.refreshToken;
    if (token) await authService.logout(token);

    reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { success: true };
  });

  // Get current user
  app.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const user = await authService.getMe(request.user!.userId);
    return { success: true, data: user };
  });

  // Update profile
  app.put('/profile', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const data = updateProfileSchema.parse(request.body);
    const user = await authService.updateProfile(request.user!.userId, data);
    return { success: true, data: user };
  });

  // Change password
  app.put('/password', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
    await authService.changePassword(request.user!.userId, currentPassword, newPassword);
    return { success: true };
  });
}
