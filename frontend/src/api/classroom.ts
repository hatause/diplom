import { api } from './client';

export interface ClassroomLocation {
  id: string;
  name: string;
}

export interface ClassroomRoom {
  name: string;
  number?: string;
  corpus?: string;
  locationId?: string;
  floor?: number | null;
  capacity?: number | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  scheduleFree?: boolean | null;
  cameraFree?: boolean | null;
  cameraStatus?: string | null;
}

export type ClassroomSearchResponse =
  | { success: true; classroom: string; additionalData: ClassroomRoom & { otherRooms: ClassroomRoom[]; alternatives: ClassroomRoom[] } }
  | { success: false; reason: 'not_found'; message?: string };

export const classroomApi = {
  getLocations: async () => {
    const res = await api.get<{ success: boolean; data: ClassroomLocation[] }>('/classroom/locations');
    return res.data.data;
  },

  search: async (data: { locationId: string; durationMinutes: number }, signal?: AbortSignal) => {
    // Backend waits up to ~12s for the Java/C++ services, so give it a little more here
    const res = await api.post<ClassroomSearchResponse>('/classroom/search', data, { signal, timeout: 20000 });
    return res.data;
  },
};
