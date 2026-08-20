import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../plugins/auth.js';

export async function teacherRoutes(app: FastifyInstance) {
  const teacherAuth = authorize('TEACHER', 'ADMIN');

  // Get teacher dashboard data
  app.get('/dashboard', { preHandler: [teacherAuth] }, async (request: FastifyRequest) => {
    const teacherId = request.user!.userId;

    const subjects = await prisma.subject.findMany({
      where: { teacherId },
      include: { _count: { select: { tests: true } } },
    });

    const subjectIds = subjects.map(s => s.id);

    const [totalStudents, recentAttempts, avgScore] = await Promise.all([
      prisma.attempt.findMany({
        where: { test: { subjectId: { in: subjectIds } }, status: 'COMPLETED' },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.attempt.findMany({
        where: { test: { subjectId: { in: subjectIds } }, status: 'COMPLETED' },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          test: { select: { title: true, difficulty: true, subject: { select: { name: true } } } },
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
      }),
      prisma.attempt.aggregate({
        where: { test: { subjectId: { in: subjectIds } }, status: 'COMPLETED' },
        _avg: { percentage: true },
      }),
    ]);

    return {
      success: true,
      data: {
        subjects: subjects.map(s => ({ id: s.id, name: s.name, testCount: s._count.tests })),
        totalStudents: totalStudents.length,
        avgScore: Math.round(avgScore._avg.percentage || 0),
        recentAttempts: recentAttempts.map(a => ({
          studentName: `${a.user.firstName} ${a.user.lastName}`,
          testTitle: a.test.title,
          subject: a.test.subject.name,
          difficulty: a.test.difficulty,
          score: a.percentage,
          completedAt: a.completedAt,
        })),
      },
    };
  });

  // Get students for a subject
  app.get('/students', { preHandler: [teacherAuth] }, async (request: FastifyRequest) => {
    const subjectId = (request.query as any)?.subjectId;
    const teacherId = request.user!.userId;

    const where: any = { test: { subject: { teacherId } }, status: 'COMPLETED' };
    if (subjectId) where.test.subjectId = subjectId;

    const attempts = await prisma.attempt.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, studentProfile: { include: { group: true } } } },
      },
      distinct: ['userId'],
    });

    const studentIds = [...new Set(attempts.map(a => a.userId))];

    const students = await Promise.all(studentIds.map(async (studentId) => {
      const user = attempts.find(a => a.userId === studentId)!.user;
      const stats = await prisma.attempt.aggregate({
        where: { userId: studentId, test: { subject: { teacherId } }, status: 'COMPLETED' },
        _avg: { percentage: true },
        _count: true,
      });

      const weakTopics = await prisma.topicProgress.findMany({
        where: { userId: studentId, masteryScore: { lt: 60 }, topic: { subject: { teacherId } } },
        include: { topic: { select: { name: true } } },
        take: 5,
      });

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        group: user.studentProfile?.group?.name,
        avgScore: Math.round(stats._avg.percentage || 0),
        testCount: stats._count,
        weakTopics: weakTopics.map(wt => wt.topic.name),
      };
    }));

    return { success: true, data: students };
  });

  // Get specific student detail
  app.get('/students/:id', { preHandler: [teacherAuth] }, async (request: FastifyRequest) => {
    const studentId = (request.params as any).id;

    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        studentProfile: { include: { group: true } },
      },
    });

    if (!user) return { success: false, error: 'Student not found' };

    const [attempts, progress] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId: studentId, status: 'COMPLETED' },
        include: { test: { include: { subject: { select: { name: true } } } } },
        orderBy: { completedAt: 'desc' },
        take: 20,
      }),
      prisma.topicProgress.findMany({
        where: { userId: studentId },
        include: { topic: { include: { subject: { select: { name: true } } } } },
      }),
    ]);

    return {
      success: true,
      data: {
        student: user,
        attempts: attempts.map(a => ({
          testTitle: a.test.title,
          subject: a.test.subject.name,
          score: a.percentage,
          difficulty: a.test.difficulty,
          completedAt: a.completedAt,
        })),
        progress: progress.map(p => ({
          topic: p.topic.name,
          subject: p.topic.subject.name,
          mastery: Math.round(p.masteryScore),
          level: p.masteryLevel,
        })),
      },
    };
  });

  // Get teacher's groups
  app.get('/groups', { preHandler: [teacherAuth] }, async (request: FastifyRequest) => {
    const teacherId = request.user!.userId;
    const groups = await prisma.group.findMany({
      where: { teachers: { some: { id: teacherId } } },
    });
    return { success: true, data: groups };
  });

  // Create a subject
  app.post('/subjects', { preHandler: [teacherAuth] }, async (request: FastifyRequest) => {
    const teacherId = request.user!.userId;
    const body = request.body as any;
    
    const subject = await prisma.subject.create({
      data: {
        name: body.name,
        code: body.code,
        description: body.description,
        teacherId: teacherId, // Automatically assigned to the requesting teacher
      },
    });
    return { success: true, data: subject };
  });
}
