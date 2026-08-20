import { ScheduleProvider, ScheduleProviderItem } from './schedule-provider.interface.js';
import { logger } from '../../lib/logger.js';

export class HttpScheduleProvider implements ScheduleProvider {
  name = 'http';

  constructor(private url: string) {}

  async fetch(): Promise<ScheduleProviderItem[]> {
    const response = await fetch(this.url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP schedule provider returned ${response.status}`);
    }

    const data = await response.json() as any;

    // Support both formats
    if (Array.isArray(data)) {
      return data.map((item: any) => this.normalizeItem(item));
    }
    if (data.items && Array.isArray(data.items)) {
      return data.items.map((item: any) => this.normalizeItem(item));
    }

    throw new Error('Unexpected response format from schedule provider');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private normalizeItem(item: any): ScheduleProviderItem {
    return {
      externalId: item.externalScheduleId || item.id?.toString(),
      subjectName: item.subjectName || item.subName || 'Unknown',
      teacherName: item.teacherName || null,
      groupCode: item.groupCode || 'DEFAULT',
      room: item.room || null,
      dayOfWeek: item.dayOfWeek ?? new Date(item.startsAt).getDay(),
      startTime: item.startTime || (item.startsAt ? new Date(item.startsAt).toTimeString().slice(0, 5) : '09:00'),
      endTime: item.endTime || (item.endsAt ? new Date(item.endsAt).toTimeString().slice(0, 5) : '10:30'),
      weekType: item.weekType || null,
    };
  }
}
