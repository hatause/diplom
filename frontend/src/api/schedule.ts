import axios from 'axios';
import { api } from './client';

export interface ScheduleGroup { id: string; name: string; code: string }
export interface ScheduleSubject {
  id: string;
  name: string;
  color?: string | null;
  teacher?: { firstName: string; lastName: string } | null;
}
export interface ScheduleFields {
  subjectId: string;
  groupId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherName: string | null;
  room: string | null;
  weekType: 'odd' | 'even' | null;
  isActive: boolean;
}
export interface ScheduleItem extends ScheduleFields {
  id: string;
  subject: ScheduleSubject;
  group: ScheduleGroup;
}

export const adminScheduleApi = {
  async load(signal?: AbortSignal) {
    const [schedule, groups, subjects] = await Promise.all([
      api.get<{ data: { items: ScheduleItem[]; total: number } }>('/admin/schedule', { signal }),
      api.get<{ data: ScheduleGroup[] }>('/admin/groups', { signal }),
      api.get<{ data: ScheduleSubject[] }>('/admin/subjects', { signal }),
    ]);
    return { items: schedule.data.data.items, groups: groups.data.data, subjects: subjects.data.data };
  },
  async save(fields: ScheduleFields, id?: string) {
    const result = id
      ? await api.put<{ data: ScheduleItem }>(`/admin/schedule/${id}`, fields)
      : await api.post<{ data: ScheduleItem }>('/admin/schedule', fields);
    return result.data.data;
  },
  async remove(id: string) { await api.delete(`/admin/schedule/${id}`); },
  async clear() {
    const result = await api.delete<{ data: { deletedCount: number } }>('/admin/schedule', {
      data: { confirmation: 'CLEAR_SCHEDULE' },
    });
    return result.data.data.deletedCount;
  },
};

export function scheduleError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.error === 'string') return body.error;
    if (error.response?.status === 422) return 'Проверьте поля формы: день недели и время начала и окончания.';
    if (error.response?.status === 403) return 'Управлять расписанием может только администратор.';
  }
  return 'Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.';
}
