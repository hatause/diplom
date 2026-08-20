import { env } from '../../config/env.js';
import { ScheduleProvider } from './schedule-provider.interface.js';
import { HttpScheduleProvider } from './http-schedule.provider.js';
import { TcpScheduleProvider } from './tcp-schedule.provider.js';
import { pushScheduleProvider } from './push-schedule.provider.js';
import { DatabaseScheduleProvider } from './database-schedule.provider.js';
import { logger } from '../../lib/logger.js';

export function createScheduleProvider(): ScheduleProvider {
  const mode = env.SCHEDULE_PROVIDER_MODE;

  switch (mode) {
    case 'http':
      if (!env.SCHEDULE_PROVIDER_HTTP_URL) {
        logger.warn('SCHEDULE_PROVIDER_HTTP_URL not set, falling back to database');
        return new DatabaseScheduleProvider();
      }
      return new HttpScheduleProvider(env.SCHEDULE_PROVIDER_HTTP_URL);

    case 'tcp':
      if (!env.SCHEDULE_PROVIDER_TCP_HOST || !env.SCHEDULE_PROVIDER_TCP_PORT) {
        logger.warn('TCP schedule config incomplete, falling back to database');
        return new DatabaseScheduleProvider();
      }
      return new TcpScheduleProvider(env.SCHEDULE_PROVIDER_TCP_HOST, env.SCHEDULE_PROVIDER_TCP_PORT);

    case 'push':
      return pushScheduleProvider;

    case 'database':
    default:
      return new DatabaseScheduleProvider();
  }
}

export const scheduleProvider = createScheduleProvider();
