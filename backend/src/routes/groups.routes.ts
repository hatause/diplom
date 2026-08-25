import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../plugins/auth.js';
import { z } from 'zod';
import { ApiError } from '../utils/api-error.js';

const createGroupSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

export async function groupsRoutes(app: FastifyInstance) {
  // Get all groups where the current teacher is assigned (or all for admin)
  app.get('/my', { preHandler: [authorize('TEACHER', 'ADMIN')] }, async (request: FastifyRequest) => {
    const isAdmin = request.user!.role === 'ADMIN';
    const groups = await prisma.group.findMany({
      where: isAdmin ? undefined : {
        teachers: {
          some: {
            id: request.user!.userId,
          },
        },
      },
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: groups };
  });

  // Create a new group
  app.post('/', { preHandler: [authorize('TEACHER', 'ADMIN')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, code } = createGroupSchema.parse(request.body);
    
    // Check if code already exists
    const existing = await prisma.group.findUnique({ where: { code } });
    if (existing) {
      throw ApiError.conflict('Group code already in use');
    }

    const group = await prisma.group.create({
      data: {
        name,
        code,
        teachers: {
          connect: { id: request.user!.userId },
        },
      },
      include: {
        _count: {
          select: { students: true },
        },
      },
    });

    return reply.code(201).send({ success: true, data: group });
  });

  // Get students in a specific group
  app.get('/:id/students', { preHandler: [authorize('TEACHER', 'ADMIN')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const groupId = request.params.id;
    
    // Verify teacher has access to this group
    if (request.user!.role === 'TEACHER') {
      const hasAccess = await prisma.group.findFirst({
        where: { id: groupId, teachers: { some: { id: request.user!.userId } } },
      });
      if (!hasAccess) throw ApiError.forbidden('You do not have access to this group');
    }

    const students = await prisma.studentProfile.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
      orderBy: { user: { lastName: 'asc' } },
    });

    return { success: true, data: students };
  });

  // Get unassigned students (Admin/Teacher)
  app.get('/unassigned-students', { preHandler: [authorize('TEACHER', 'ADMIN')] }, async (request: FastifyRequest) => {
    // A student is unassigned if they have no studentProfile or their studentProfile has no groupId
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        OR: [
          { studentProfile: null },
          { studentProfile: { groupId: null } }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      }
    });
    return { success: true, data: students };
  });

  // Assign student to group (Admin/Teacher)
  app.post('/:id/students', { preHandler: [authorize('TEACHER', 'ADMIN')] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const groupId = request.params.id;
    const { studentId } = request.body as any;

    if (!studentId) return reply.code(400).send({ success: false, error: 'studentId is required' });

    // Check if group exists
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return reply.code(404).send({ success: false, error: 'Group not found' });

    // Upsert student profile
    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId: studentId },
      create: {
        userId: studentId,
        groupId: groupId,
      },
      update: {
        groupId: groupId,
      }
    });

    return { success: true, data: studentProfile };
  });

  // Delete a group (Admin only)
  app.delete('/:id', { preHandler: [authorize('ADMIN')] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const groupId = request.params.id;

    // The group might have students assigned to it.
    // In schema.prisma, StudentProfile has: group Group? @relation(fields: [groupId], references: [id])
    // But it does not have onDelete: Cascade for the group relation.
    // Wait, let's just detach students first to be safe.
    await prisma.studentProfile.updateMany({
      where: { groupId },
      data: { groupId: null }
    });

    // Delete the group
    await prisma.group.delete({
      where: { id: groupId }
    });

    return { success: true };
  });
}
