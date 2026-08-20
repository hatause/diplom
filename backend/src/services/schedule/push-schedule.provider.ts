import { ScheduleProvider, ScheduleProviderItem } from './schedule-provider.interface.js';
import { logger } from '../../lib/logger.js';

/**
 * Push provider stores data received from external server pushes.
 * The actual HTTP endpoint for receiving pushes is set up in the routes.
 */
export class PushScheduleProvider implements ScheduleProvider {
  name = 'push';
  private items: ScheduleProviderItem[] = [];
  private lastPushAt: Date | null = null;

  async fetch(): Promise<ScheduleProviderItem[]> {
    return this.items;
  }

  async isAvailable(): Promise<boolean> {
    return this.items.length > 0;
  }

  receiveData(data: any[]): void {
    this.items = data.map((item: any) => ({
      externalId: item.id?.toString(),
      subjectName: item.subjectName || item.subName || 'Unknown',
      teacherName: item.teacherName || null,
      groupCode: item.groupCode || 'DEFAULT',
      room: item.room || null,
      dayOfWeek: item.dayOfWeek ?? 1,
      startTime: item.startTime || '09:00',
      endTime: item.endTime || '10:30',
      weekType: item.weekType || null,
    }));
    this.lastPushAt = new Date();
    logger.info({ count: this.items.length }, 'Received push schedule data');
  }

  getLastPushAt(): Date | null {
    return this.lastPushAt;
  }
}

export const pushScheduleProvider = new PushScheduleProvider();
