import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../plugins/auth.js';

export async function reviewRoutes(app: FastifyInstance) {
  // Get topics due for review (spaced repetition)
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;

    const dueTopics = await prisma.topicProgress.findMany({
      where: {
        userId,
        OR: [
          { nextReviewAt: { lte: new Date() } },
          { masteryScore: { lt: 60 } },
        ],
      },
      include: {
        topic: { include: { subject: { select: { id: true, name: true, color: true } } } },
      },
      orderBy: [
        { nextReviewAt: 'asc' },
        { masteryScore: 'asc' },
      ],
    });

    return {
      success: true,
      data: dueTopics.map(tp => ({
        id: tp.id,
        topicId: tp.topicId,
        topicName: tp.topic.name,
        subjectId: tp.topic.subject.id,
        subjectName: tp.topic.subject.name,
        subjectColor: tp.topic.subject.color,
        masteryScore: Math.round(tp.masteryScore),
        masteryLevel: tp.masteryLevel,
        lastStudiedAt: tp.lastStudiedAt,
        nextReviewAt: tp.nextReviewAt,
        reviewInterval: tp.reviewInterval,
        isOverdue: tp.nextReviewAt ? tp.nextReviewAt <= new Date() : true,
      })),
    };
  });
}
