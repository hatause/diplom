import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../plugins/auth.js';
import { geminiService } from '../services/ai/gemini.service.js';
import { ApiError } from '../utils/api-error.js';

export async function lecturesRoutes(app: FastifyInstance) {
  const teacherOrAdminAuth = authorize('TEACHER', 'ADMIN');
  const anyAuth = authorize();

  // Get lectures for a group
  app.get('/group/:groupId', { preHandler: [anyAuth] }, async (request: FastifyRequest) => {
    const groupId = (request.params as any).groupId;
    const lectures = await prisma.lecture.findMany({
      where: { groupId },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: lectures };
  });

  // Get specific lecture
  app.get('/:id', { preHandler: [anyAuth] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const lecture = await prisma.lecture.findUnique({
      where: { id },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } }
      },
    });
    if (!lecture) throw ApiError.notFound('Lecture not found');
    return { success: true, data: lecture };
  });

  // Create lecture
  app.post('/', { preHandler: [teacherOrAdminAuth] }, async (request: FastifyRequest) => {
    const { title, content, groupId, subjectId } = request.body as any;
    const teacherId = request.user!.userId;
    
    const lecture = await prisma.lecture.create({
      data: {
        title,
        content,
        groupId,
        subjectId,
        teacherId,
      }
    });
    
    return { success: true, data: lecture };
  });

  // Explain lecture with AI
  app.post('/:id/explain', { preHandler: [anyAuth] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const lecture = await prisma.lecture.findUnique({ where: { id } });
    if (!lecture) throw ApiError.notFound('Lecture not found');

    const systemPrompt = "Вы опытный преподаватель. Перескажите и объясните следующую лекцию простым, понятным языком, выделив главные мысли и концепции. Используйте форматирование markdown для лучшей читаемости.";
    const userPrompt = `Название лекции: ${lecture.title}\n\nТекст лекции:\n${lecture.content}`;

    const explanation = await geminiService.generateText(systemPrompt, userPrompt);
    
    // Log AI Interaction
    await prisma.aIInteraction.create({
      data: {
        userId: request.user!.userId,
        type: 'LECTURE_EXPLANATION',
        prompt: userPrompt.substring(0, 500),
        response: explanation,
        model: 'gemini-2.5-flash',
      }
    });

    return { success: true, data: { explanation } };
  });

  // Generate test based on lecture
  app.post('/:id/generate-test', { preHandler: [anyAuth] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const lecture = await prisma.lecture.findUnique({ where: { id } });
    if (!lecture) throw ApiError.notFound('Lecture not found');

    const { testService } = await import('../services/test.service.js');
    
    const test = await testService.generateTest({
      userId: request.user!.userId,
      subjectId: lecture.subjectId,
      topic: lecture.title,
      difficulty: 'medium',
      questionCount: 5,
      questionTypes: ['single_choice', 'multiple_choice', 'true_false'],
      extraContext: lecture.content,
    });

    return { success: true, data: test };
  });
}
