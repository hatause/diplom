import { ScheduleProvider, ScheduleProviderItem } from './schedule-provider.interface.js';
import { prisma } from '../../lib/prisma.js';

export class DatabaseScheduleProvider implements ScheduleProvider {
  name = 'database';

  async fetch(): Promise<ScheduleProviderItem[]> {
    const items = await prisma.scheduleItem.findMany({
      where: { isActive: true },
      include: {
        subject: { select: { name: true } },
        group: { select: { code: true } },
      },
    });

    return items.map(item => ({
      externalId: item.externalId || item.id,
      subjectName: item.subject.name,
      teacherName: item.teacherName || null,
      groupCode: item.group.code,
      room: item.room || null,
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      weekType: item.weekType || null,
    }));
  }

  async isAvailable(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
