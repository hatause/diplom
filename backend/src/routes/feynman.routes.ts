import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { feynmanService } from '../services/ai/feynman.service.js';
import { feynmanCreateSchema, feynmanExplainSchema } from '../schemas/index.js';

export async function feynmanRoutes(app: FastifyInstance) {
  // Create Feynman session
  app.post('/sessions', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const data = feynmanCreateSchema.parse(request.body);
    const session = await feynmanService.createSession(request.user!.userId, data.topic, data.subjectId);
    return { success: true, data: session };
  });

  // Get session by ID
  app.get('/sessions/:id', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const session = await feynmanService.getSession(request.user!.userId, id);
    return { success: true, data: session };
  });

  // Send explanation
  app.post('/sessions/:id/explain', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const data = feynmanExplainSchema.parse(request.body);
    const session = await feynmanService.sendExplanation(request.user!.userId, id, data.explanation);
    return { success: true, data: session };
  });

  // Complete session
  app.post('/sessions/:id/complete', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const session = await feynmanService.completeSession(request.user!.userId, id);
    return { success: true, data: session };
  });
}
