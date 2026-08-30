import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { debateService } from '../services/ai/debate.service.js';
import { debateCreateSchema, debateArgueSchema } from '../schemas/index.js';

export async function debateRoutes(app: FastifyInstance) {
  // Create debate session
  app.post('/sessions', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const data = debateCreateSchema.parse(request.body);
    const session = await debateService.createSession(
      request.user!.userId,
      data.topic,
      data.position,
      data.subjectId
    );
    return { success: true, data: session };
  });

  // Get session by ID
  app.get('/sessions/:id', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const session = await debateService.getSession(request.user!.userId, id);
    return { success: true, data: session };
  });

  // Send argument
  app.post('/sessions/:id/argue', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const data = debateArgueSchema.parse(request.body);
    const session = await debateService.sendArgument(request.user!.userId, id, data.argument);
    return { success: true, data: session };
  });

  // Complete session
  app.post('/sessions/:id/complete', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const session = await debateService.completeSession(request.user!.userId, id);
    return { success: true, data: session };
  });
}
