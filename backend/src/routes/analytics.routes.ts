import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../plugins/auth.js';

export async function analyticsRoutes(app: FastifyInstance) {
  // Overall analytics
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;

    const [totalAttempts, completedAttempts, avgScore, topicProgress, recentSessions, profile] = await Promise.all([
      prisma.attempt.count({ where: { userId } }),
      prisma.attempt.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.attempt.aggregate({
        where: { userId, status: 'COMPLETED' },
        _avg: { percentage: true },
      }),
      prisma.topicProgress.findMany({
        where: { userId },
        include: { topic: { include: { subject: { select: { name: true, color: true } } } } },
        orderBy: { masteryScore: 'asc' },
      }),
      prisma.studySession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.studentProfile.findUnique({ where: { userId } }),
    ]);

    // Progress over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const progressOverTime = await prisma.attempt.findMany({
      where: { userId, status: 'COMPLETED', completedAt: { gte: thirtyDaysAgo } },
      select: { percentage: true, completedAt: true },
      orderBy: { completedAt: 'asc' },
    });

    // Accuracy by difficulty
    const byDifficulty = await prisma.attempt.groupBy({
      by: ['testId'],
      where: { userId, status: 'COMPLETED' },
      _avg: { percentage: true },
    });

    return {
      success: true,
      data: {
        overview: {
          totalAttempts,
          completedAttempts,
          avgScore: Math.round(avgScore._avg.percentage || 0),
          xp: profile?.xp || 0,
          streak: profile?.streak || 0,
          bestStreak: profile?.bestStreak || 0,
        },
        topicProgress: topicProgress.map(tp => ({
          id: tp.id,
          topicName: tp.topic.name,
          subjectName: tp.topic.subject.name,
          subjectColor: tp.topic.subject.color,
          masteryScore: Math.round(tp.masteryScore),
          masteryLevel: tp.masteryLevel,
          totalAttempts: tp.totalAttempts,
          correctAnswers: tp.correctAnswers,
          wrongAnswers: tp.wrongAnswers,
          lastStudiedAt: tp.lastStudiedAt,
          nextReviewAt: tp.nextReviewAt,
        })),
        progressOverTime: progressOverTime.map(p => ({
          date: p.completedAt?.toISOString().split('T')[0],
          score: p.percentage,
        })),
        studyActivity: recentSessions.map(s => ({
          date: s.createdAt.toISOString().split('T')[0],
          type: s.activityType,
          duration: s.duration,
          xpEarned: s.xpEarned,
        })),
      },
    };
  });

  // Analytics by subject
  app.get('/subjects', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;

    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true },
    });

    const stats = await Promise.all(subjects.map(async (subject) => {
      const attempts = await prisma.attempt.aggregate({
        where: { userId, test: { subjectId: subject.id }, status: 'COMPLETED' },
        _avg: { percentage: true },
        _count: true,
      });

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        color: subject.color,
        avgScore: Math.round(attempts._avg.percentage || 0),
        testCount: attempts._count,
      };
    }));

    return { success: true, data: stats.filter(s => s.testCount > 0) };
  });

  // Analytics by topic
  app.get('/topics', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;
    const subjectId = (request.query as any)?.subjectId;

    const where: any = { userId };
    if (subjectId) where.topic = { subjectId };

    const progress = await prisma.topicProgress.findMany({
      where,
      include: { topic: { include: { subject: { select: { name: true } } } } },
      orderBy: { masteryScore: 'asc' },
    });

    return {
      success: true,
      data: progress.map(p => ({
        topicName: p.topic.name,
        subjectName: p.topic.subject.name,
        masteryScore: Math.round(p.masteryScore),
        masteryLevel: p.masteryLevel,
        totalAttempts: p.totalAttempts,
        correctAnswers: p.correctAnswers,
        wrongAnswers: p.wrongAnswers,
      })),
    };
  });
}
