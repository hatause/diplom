import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../plugins/auth.js';
import { z } from 'zod';
import { ApiError } from '../utils/api-error.js';

const sendMessageSchema = z.object({
  receiverId: z.string(),
  content: z.string().min(1),
});

export async function messagesRoutes(app: FastifyInstance) {
  // Get contacts (people the user has chatted with, plus students for teachers, or teachers for students)
  app.get('/contacts', { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const userId = request.user!.userId;
    const role = request.user!.role;

    let contacts: any[] = [];

    if (role === 'TEACHER') {
      // Teachers can see their students (from groups they teach)
      const groups = await prisma.group.findMany({
        where: { teachers: { some: { id: userId } } },
        include: {
          students: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } }
          }
        }
      });
      const uniqueStudents = new Map();
      groups.forEach(g => {
        g.students.forEach(s => uniqueStudents.set(s.userId, s.user));
      });
      contacts = Array.from(uniqueStudents.values());
    } else if (role === 'STUDENT') {
      // Students can see teachers of their group
      const profile = await prisma.studentProfile.findUnique({
        where: { userId },
        include: { group: { include: { teachers: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } } }
      });
      if (profile?.group?.teachers) {
        contacts = profile.group.teachers;
      }
    } else if (role === 'ADMIN') {
       // Admins can see everyone
       contacts = await prisma.user.findMany({
         where: { id: { not: userId } },
         select: { id: true, firstName: true, lastName: true, avatarUrl: true }
       });
    }

    // Include people we already have messages with
    const existingMessages = await prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      select: { senderId: true, receiverId: true }
    });

    const contactIds = new Set(contacts.map(c => c.id));
    const idsToFetch = new Set<string>();
    existingMessages.forEach(m => {
      if (m.senderId !== userId && !contactIds.has(m.senderId)) idsToFetch.add(m.senderId);
      if (m.receiverId !== userId && !contactIds.has(m.receiverId)) idsToFetch.add(m.receiverId);
    });

    if (idsToFetch.size > 0) {
      const extraContacts = await prisma.user.findMany({
        where: { id: { in: Array.from(idsToFetch) } },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true }
      });
      contacts = [...contacts, ...extraContacts];
    }

    return { success: true, data: contacts };
  });

  // Get messages with a specific user
  app.get('/:userId', { preHandler: [authenticate] }, async (request: FastifyRequest<{ Params: { userId: string } }>) => {
    const myId = request.user!.userId;
    const otherId = request.params.userId;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: myId, receiverId: otherId },
          { senderId: otherId, receiverId: myId },
        ]
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark as read
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: myId, isRead: false },
      data: { isRead: true }
    });

    return { success: true, data: messages };
  });

  // Send message
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { receiverId, content } = sendMessageSchema.parse(request.body);
    const senderId = request.user!.userId;

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
      }
    });

    return reply.code(201).send({ success: true, data: message });
  });
}
