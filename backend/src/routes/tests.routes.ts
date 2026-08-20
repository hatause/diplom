import { FastifyInstance, FastifyRequest } from 'fastify';
import { testService } from '../services/test.service.js';
import { authenticate } from '../plugins/auth.js';
import { generateTestSchema, submitTestSchema } from '../schemas/index.js';

export async function testRoutes(app: FastifyInstance) {
  // Generate a test via AI
  app.post('/generate', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const params = generateTestSchema.parse(request.body);
    const test = await testService.generateTest({
      userId: request.user!.userId,
      ...params,
    });
    return { success: true, data: test };
  });

  // Get test (without answers)
  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const testId = (request.params as any).id;
    const test = await testService.getTest(testId, false);
    return { success: true, data: test };
  });

  // Start an attempt
  app.post('/:id/start', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const testId = (request.params as any).id;
    const attempt = await testService.startAttempt(request.user!.userId, testId);
    return { success: true, data: attempt };
  });

  // Save progress (auto-save)
  app.put('/:id/progress', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const attemptId = (request.params as any).id;
    const progress = request.body;
    const result = await testService.saveProgress(attemptId, request.user!.userId, progress);
    return { success: true, data: { savedAt: result.updatedAt } };
  });

  // Submit test
  app.post('/:id/submit', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const attemptId = (request.params as any).id;
    const { answers, totalTime } = submitTestSchema.parse(request.body);
    const result = await testService.submitAttempt(attemptId, request.user!.userId, answers, totalTime);
    return { success: true, data: result };
  });
}
