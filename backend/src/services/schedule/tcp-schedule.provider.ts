import net from 'node:net';
import { ScheduleProvider, ScheduleProviderItem } from './schedule-provider.interface.js';
import { logger } from '../../lib/logger.js';

export class TcpScheduleProvider implements ScheduleProvider {
  name = 'tcp';

  constructor(private host: string, private port: number) {}

  async fetch(): Promise<ScheduleProviderItem[]> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let data = '';
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('TCP schedule provider timeout'));
      }, 10000);

      client.connect(this.port, this.host, () => {
        client.write(JSON.stringify({ action: 'getSchedule' }) + '\n');
      });

      client.on('data', (chunk) => { data += chunk.toString(); });

      client.on('end', () => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data);
          const items = Array.isArray(parsed) ? parsed : parsed.items || [];
          resolve(items.map((item: any) => ({
            externalId: item.id?.toString(),
            subjectName: item.subjectName || item.subName || 'Unknown',
            teacherName: item.teacherName || null,
            groupCode: item.groupCode || 'DEFAULT',
            room: item.room || null,
            dayOfWeek: item.dayOfWeek ?? 1,
            startTime: item.startTime || '09:00',
            endTime: item.endTime || '10:30',
            weekType: item.weekType || null,
          })));
        } catch (err) {
          reject(new Error('Invalid TCP response'));
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      const timeout = setTimeout(() => { client.destroy(); resolve(false); }, 3000);
      client.connect(this.port, this.host, () => {
        clearTimeout(timeout);
        client.destroy();
        resolve(true);
      });
      client.on('error', () => { clearTimeout(timeout); resolve(false); });
    });
  }
}
