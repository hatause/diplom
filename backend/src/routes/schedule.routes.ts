import { FastifyInstance, FastifyRequest } from 'fastify';
import { scheduleService } from '../services/schedule.service.js';
import { authenticate } from '../plugins/auth.js';
import { pushScheduleProvider } from '../services/schedule/push-schedule.provider.js';

export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const groupCode = (request.query as any)?.group;
    const data = await scheduleService.getSchedule(groupCode);
    return { success: true, data };
  });

  app.get('/today', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const groupCode = (request.query as any)?.group;
    const data = await scheduleService.getToday(groupCode);
    return { success: true, data };
  });

  app.get('/week', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const groupCode = (request.query as any)?.group;
    const data = await scheduleService.getWeek(groupCode);
    return { success: true, data };
  });

  app.get('/status', { preHandler: [authenticate] }, async () => {
    return { success: true, data: scheduleService.getStatus() };
  });

  app.post('/sync', { preHandler: [authenticate] }, async () => {
    const result = await scheduleService.syncSchedule();
    return { success: true, data: result };
  });

  // Push endpoint for external servers to send schedule data
  app.post('/push', async (request: FastifyRequest) => {
    const data = request.body as any[];
    pushScheduleProvider.receiveData(Array.isArray(data) ? data : [data]);
    return { success: true, message: 'Schedule data received' };
  });
}
