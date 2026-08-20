import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { API_PREFIX, APP_NAME } from './config/constants.js';
import { logger } from './lib/logger.js';
import { ApiError } from './utils/api-error.js';
import { authRoutes } from './routes/auth.routes.js';
import { subjectRoutes } from './routes/subjects.routes.js';
import { scheduleRoutes } from './routes/schedule.routes.js';
import { testRoutes } from './routes/tests.routes.js';
import { attemptRoutes } from './routes/attempts.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { teacherRoutes } from './routes/teacher.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { reviewRoutes } from './routes/review.routes.js';
import { achievementRoutes } from './routes/achievements.routes.js';
import { lecturesRoutes } from './routes/lectures.routes.js';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  // ── Plugins ──
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  await app.register(cookie, {
    secret: env.JWT_SECRET,
    parseOptions: {},
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  // ── Swagger ──
  await app.register(swagger, {
    openapi: {
      info: {
        title: `${APP_NAME} API`,
        description: 'AI-Powered Learning Platform API',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { deepLinking: true },
  });

  // ── Error handler ──
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        details: error.details,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        details: error.validation,
      });
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: 'Too many requests. Please slow down.',
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      success: false,
      error: env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    });
  });

  // ── Routes ──
  await app.register(authRoutes, { prefix: `${API_PREFIX}/auth` });
  await app.register(subjectRoutes, { prefix: `${API_PREFIX}/subjects` });
  await app.register(scheduleRoutes, { prefix: `${API_PREFIX}/schedule` });
  await app.register(testRoutes, { prefix: `${API_PREFIX}/tests` });
  await app.register(attemptRoutes, { prefix: `${API_PREFIX}/attempts` });
  await app.register(analyticsRoutes, { prefix: `${API_PREFIX}/analytics` });
  await app.register(aiRoutes, { prefix: `${API_PREFIX}/ai` });
  await app.register(teacherRoutes, { prefix: `${API_PREFIX}/teacher` });
  await app.register(adminRoutes, { prefix: `${API_PREFIX}/admin` });
  await app.register(reviewRoutes, { prefix: `${API_PREFIX}/review` });
  await app.register(achievementRoutes, { prefix: `${API_PREFIX}/achievements` });
  await app.register(lecturesRoutes, { prefix: `${API_PREFIX}/lectures` });

  // ── Health check ──
  app.get('/health', async () => ({ status: 'ok', name: APP_NAME, timestamp: new Date().toISOString() }));

  return app;
}

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`🚀 ${APP_NAME} backend running on port ${env.PORT}`);
    logger.info(`📚 Swagger docs: http://localhost:${env.PORT}/docs`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

start();
