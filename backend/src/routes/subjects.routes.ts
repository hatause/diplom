import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../plugins/auth.js';

export async function subjectRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;

    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      include: {
        topics: { select: { id: true, name: true }, orderBy: { orderIndex: 'asc' } },
        teacher: { select: { firstName: true, lastName: true } },
        _count: { select: { tests: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Get user stats per subject
    const enriched = await Promise.all(subjects.map(async (subject) => {
      const attempts = await prisma.attempt.findMany({
        where: { userId, test: { subjectId: subject.id }, status: 'COMPLETED' },
        select: { percentage: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
      });

      const avgScore = attempts.length > 0
        ? attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length
        : 0;

      const progress = await prisma.topicProgress.findMany({
        where: { userId, topic: { subjectId: subject.id } },
        include: { topic: { select: { name: true } } },
      });

      const weakTopics = progress
        .filter(p => p.masteryScore < 60)
        .map(p => ({ name: p.topic.name, score: Math.round(p.masteryScore) }));

      const overallMastery = progress.length > 0
        ? progress.reduce((sum, p) => sum + p.masteryScore, 0) / progress.length
        : 0;

      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        iconName: subject.iconName,
        color: subject.color,
        teacher: subject.teacher
          ? `${subject.teacher.firstName} ${subject.teacher.lastName}`
          : null,
        topicCount: subject.topics.length,
        topics: subject.topics,
        testCount: subject._count.tests,
        avgScore: Math.round(avgScore),
        mastery: Math.round(overallMastery),
        weakTopics,
        attemptsCount: attempts.length,
        lastActivity: attempts[0]?.completedAt || null,
      };
    }));

    return { success: true, data: enriched };
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = request.user!.userId;
    const subjectId = (request.params as any).id;

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        topics: {
          orderBy: { orderIndex: 'asc' },
          include: {
            topicProgress: { where: { userId }, take: 1 },
          },
        },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    if (!subject) return { success: false, error: 'Subject not found' };

    return { success: true, data: subject };
  });
}
