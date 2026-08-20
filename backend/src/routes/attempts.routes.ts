import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../plugins/auth.js';

export async function attemptRoutes(app: FastifyInstance) {
  // Get all attempts for user
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;
    const query = request.query as any;

    const where: any = { userId };
    if (query.status) where.status = query.status;
    if (query.subjectId) where.test = { subjectId: query.subjectId };

    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '20'), 50);
    const skip = (page - 1) * limit;

    const [attempts, total] = await Promise.all([
      prisma.attempt.findMany({
        where,
        include: {
          test: {
            include: {
              subject: { select: { id: true, name: true, color: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.attempt.count({ where }),
    ]);

    return {
      success: true,
      data: {
        attempts: attempts.map(a => ({
          id: a.id,
          testId: a.testId,
          testTitle: a.test.title,
          subject: a.test.subject,
          topic: a.test.topic,
          difficulty: a.test.difficulty,
          status: a.status,
          score: a.score,
          percentage: a.percentage,
          correctCount: a.correctCount,
          wrongCount: a.wrongCount,
          skippedCount: a.skippedCount,
          questionCount: a.test.questionCount,
          totalTime: a.totalTime,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    };
  });

  // Get attempt detail with answers
  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const attemptId = (request.params as any).id;
    const userId = request.user!.userId;

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            subject: { select: { id: true, name: true } },
            questions: { orderBy: { orderIndex: 'asc' } },
          },
        },
        answers: true,
      },
    });

    if (!attempt || attempt.userId !== userId) {
      return { success: false, error: 'Attempt not found' };
    }

    // Only show correct answers if attempt is completed
    const showAnswers = attempt.status === 'COMPLETED';

    return {
      success: true,
      data: {
        ...attempt,
        test: {
          ...attempt.test,
          questions: attempt.test.questions.map(q => ({
            ...q,
            correctAnswer: showAnswers ? q.correctAnswer : undefined,
            explanation: showAnswers ? q.explanation : undefined,
          })),
        },
      },
    };
  });

  // Get result with AI analysis
  app.get('/:id/result', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const attemptId = (request.params as any).id;
    const userId = request.user!.userId;

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            subject: { select: { id: true, name: true } },
            questions: { orderBy: { orderIndex: 'asc' } },
          },
        },
        answers: {
          include: { question: true },
        },
      },
    });

    if (!attempt || attempt.userId !== userId) {
      return { success: false, error: 'Attempt not found' };
    }

    if (attempt.status !== 'COMPLETED') {
      return { success: false, error: 'Attempt not yet completed' };
    }

    // Enrich answers with question details
    const enrichedAnswers = attempt.answers.map(ans => ({
      questionId: ans.questionId,
      question: ans.question.question,
      type: ans.question.type,
      options: ans.question.options,
      userAnswer: ans.userAnswer,
      correctAnswer: ans.question.correctAnswer,
      isCorrect: ans.isCorrect,
      explanation: ans.question.explanation,
      timeSpent: ans.timeSpent,
    }));

    return {
      success: true,
      data: {
        id: attempt.id,
        test: {
          id: attempt.test.id,
          title: attempt.test.title,
          subject: attempt.test.subject,
          topic: attempt.test.topic,
          difficulty: attempt.test.difficulty,
        },
        score: attempt.score,
        percentage: attempt.percentage,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        skippedCount: attempt.skippedCount,
        totalTime: attempt.totalTime,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        answers: enrichedAnswers,
        aiAnalysis: attempt.aiAnalysis,
      },
    };
  });
}
