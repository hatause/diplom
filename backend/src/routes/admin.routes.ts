import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../plugins/auth.js';
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '../config/constants.js';

export async function adminRoutes(app: FastifyInstance) {
  const adminAuth = authorize('ADMIN');

  // Users
  app.get('/users', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const query = request.query as any;
    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const search = query.search || '';
    const role = query.role;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, createdAt: true, lastLoginAt: true,
          studentProfile: { include: { group: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { success: true, data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } };
  });

  app.post('/users', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const body = request.body as any;
    const passwordHash = await bcrypt.hash(body.password || 'password123', SALT_ROUNDS);
    
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role || 'STUDENT',
      }
    });

    if (user.role === 'STUDENT' && body.groupId) {
      await prisma.studentProfile.create({
        data: { userId: user.id, groupId: body.groupId }
      });
    }

    return { success: true, data: user };
  });


  app.put('/users/:id', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    const body = request.body as any;

    const data: any = {};
    if (body.firstName) data.firstName = body.firstName;
    if (body.lastName) data.lastName = body.lastName;
    if (body.role) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const user = await prisma.user.update({ where: { id }, data, select: { id: true, email: true, role: true, isActive: true } });

    await prisma.auditLog.create({
      data: {
        userId: request.user!.userId,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: id,
        details: { changes: Object.keys(data) },
      },
    });

    return { success: true, data: user };
  });

  app.delete('/users/:id', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const id = (request.params as any).id;
    await prisma.user.update({ where: { id }, data: { isActive: false } });

    await prisma.auditLog.create({
      data: { userId: request.user!.userId, action: 'DEACTIVATE_USER', entity: 'User', entityId: id },
    });

    return { success: true };
  });

  // Groups
  app.get('/groups', { preHandler: [adminAuth] }, async () => {
    const groups = await prisma.group.findMany({
      include: { _count: { select: { students: true, scheduleItems: true } } },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: groups };
  });

  app.post('/groups', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const { name, code } = request.body as any;
    const group = await prisma.group.create({ data: { name, code: code || name } });
    return { success: true, data: group };
  });

  app.post('/groups/:id/teachers', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const groupId = (request.params as any).id;
    const { teacherId } = request.body as any;
    
    const group = await prisma.group.update({
      where: { id: groupId },
      data: {
        teachers: { connect: { id: teacherId } }
      }
    });
    
    return { success: true, data: group };
  });


  // Subjects
  app.get('/subjects', { preHandler: [adminAuth] }, async () => {
    const subjects = await prisma.subject.findMany({
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        topics: { select: { id: true, name: true } },
        _count: { select: { tests: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: subjects };
  });

  app.post('/subjects', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const body = request.body as any;
    const subject = await prisma.subject.create({
      data: {
        name: body.name,
        code: body.code,
        description: body.description,
        teacherId: body.teacherId || null,
        iconName: body.iconName,
        color: body.color,
      },
    });
    return { success: true, data: subject };
  });

  app.post('/subjects/:id/topics', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const subjectId = (request.params as any).id;
    const { name, description } = request.body as any;
    const topic = await prisma.topic.create({ data: { name, description, subjectId } });
    return { success: true, data: topic };
  });

  // Schedule
  app.post('/schedule', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const body = request.body as any;
    const items = Array.isArray(body) ? body : [body];
    
    const created = await Promise.all(items.map(async (item) => {
      const subject = await prisma.subject.findUnique({ where: { id: item.subjectId }, include: { teacher: true } });
      const teacherName = subject?.teacher ? `${subject.teacher.firstName} ${subject.teacher.lastName}` : null;
      
      return prisma.scheduleItem.create({
        data: {
          subjectId: item.subjectId,
          groupId: item.groupId,
          teacherName: teacherName,
          room: item.room,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          weekType: item.weekType,
        }
      });
    }));
    
    return { success: true, data: created };
  });


  // Audit logs
  app.get('/audit-logs', { preHandler: [adminAuth] }, async (request: FastifyRequest) => {
    const query = request.query as any;
    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '50'), 100);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.auditLog.count(),
    ]);

    return { success: true, data: { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } };
  });

  // Dashboard
  app.get('/dashboard', { preHandler: [adminAuth] }, async () => {
    const [userCount, studentCount, teacherCount, subjectCount, testCount, attemptCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.subject.count(),
      prisma.test.count(),
      prisma.attempt.count({ where: { status: 'COMPLETED' } }),
    ]);

    return {
      success: true,
      data: { userCount, studentCount, teacherCount, subjectCount, testCount, attemptCount },
    };
  });
}
