import { prisma } from '../lib/prisma.js';
import { scheduleProvider } from './schedule/schedule-provider.factory.js';
import { logger } from '../lib/logger.js';
import type { ScheduleProviderItem } from './schedule/schedule-provider.interface.js';

export class ScheduleService {
  private lastSnapshot: ScheduleProviderItem[] = [];
  private lastSyncAt: Date | null = null;
  private syncStatus: 'connected' | 'syncing' | 'offline' = 'offline';

  async syncSchedule(): Promise<{ items: ScheduleProviderItem[]; status: string; lastSyncAt: Date | null }> {
    this.syncStatus = 'syncing';
    try {
      const items = await scheduleProvider.fetch();
      this.lastSnapshot = items;
      this.lastSyncAt = new Date();
      this.syncStatus = 'connected';

      // Save snapshot
      await prisma.scheduleSnapshot.create({
        data: {
          providerMode: scheduleProvider.name,
          data: items as any,
          syncedAt: this.lastSyncAt,
          success: true,
        },
      });

      // Upsert schedule items into DB
      await this.upsertScheduleItems(items);

      logger.info({ count: items.length, provider: scheduleProvider.name }, 'Schedule synced');
      return { items, status: this.syncStatus, lastSyncAt: this.lastSyncAt };
    } catch (error: any) {
      this.syncStatus = 'offline';
      logger.warn({ error: error.message }, 'Schedule sync failed, using last snapshot');

      await prisma.scheduleSnapshot.create({
        data: {
          providerMode: scheduleProvider.name,
          data: {},
          success: false,
          errorMessage: error.message,
        },
      });

      // Fallback to last snapshot
      if (this.lastSnapshot.length === 0) {
        const lastGood = await prisma.scheduleSnapshot.findFirst({
          where: { success: true },
          orderBy: { syncedAt: 'desc' },
        });
        if (lastGood) {
          this.lastSnapshot = lastGood.data as unknown as ScheduleProviderItem[];
          this.lastSyncAt = lastGood.syncedAt;
        }
      }

      return { items: this.lastSnapshot, status: this.syncStatus, lastSyncAt: this.lastSyncAt };
    }
  }

  async getSchedule(groupCode?: string): Promise<any> {
    const where: any = { isActive: true };
    if (groupCode) {
      where.group = { code: groupCode };
    }

    const items = await prisma.scheduleItem.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true, color: true, iconName: true } },
        group: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return {
      items,
      status: this.syncStatus,
      lastSyncAt: this.lastSyncAt,
      providerMode: scheduleProvider.name,
    };
  }

  async getToday(groupCode?: string): Promise<any> {
    const today = new Date().getDay();
    const where: any = { isActive: true, dayOfWeek: today };
    if (groupCode) where.group = { code: groupCode };

    const items = await prisma.scheduleItem.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        group: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return { items, dayOfWeek: today, status: this.syncStatus };
  }

  async getWeek(groupCode?: string): Promise<any> {
    const where: any = { isActive: true };
    if (groupCode) where.group = { code: groupCode };

    const items = await prisma.scheduleItem.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        group: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Group by day
    const week: Record<number, typeof items> = {};
    for (let i = 0; i < 7; i++) week[i] = [];
    items.forEach(item => { week[item.dayOfWeek].push(item); });

    return { week, status: this.syncStatus };
  }

  private async upsertScheduleItems(items: ScheduleProviderItem[]) {
    for (const item of items) {
      try {
        const subject = await prisma.subject.upsert({
          where: { code: item.subjectName.replace(/\s+/g, '_').toUpperCase().slice(0, 20) },
          create: { name: item.subjectName, code: item.subjectName.replace(/\s+/g, '_').toUpperCase().slice(0, 20) },
          update: {},
        });

        const group = await prisma.group.upsert({
          where: { code: item.groupCode },
          create: { name: item.groupCode, code: item.groupCode },
          update: {},
        });

        await prisma.scheduleItem.upsert({
          where: { id: item.externalId || `${subject.id}_${group.id}_${item.dayOfWeek}_${item.startTime}` },
          create: {
            externalId: item.externalId,
            subjectId: subject.id,
            groupId: group.id,
            teacherName: item.teacherName,
            room: item.room,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
            weekType: item.weekType,
          },
          update: {
            teacherName: item.teacherName,
            room: item.room,
            startTime: item.startTime,
            endTime: item.endTime,
          },
        });
      } catch (err: any) {
        logger.warn({ error: err.message, item: item.subjectName }, 'Failed to upsert schedule item');
      }
    }
  }

  getStatus() {
    return { status: this.syncStatus, lastSyncAt: this.lastSyncAt, provider: scheduleProvider.name };
  }
}

export const scheduleService = new ScheduleService();
