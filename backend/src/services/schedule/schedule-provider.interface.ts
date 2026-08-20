export interface ScheduleProviderItem {
  externalId?: string;
  subjectName: string;
  teacherName?: string;
  groupCode: string;
  room?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weekType?: string;
}

export interface ScheduleProvider {
  name: string;
  fetch(): Promise<ScheduleProviderItem[]>;
  isAvailable(): Promise<boolean>;
}
