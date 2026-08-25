import { api } from './client';

export interface Group {
  id: string;
  name: string;
  code: string;
  _count: { students: number };
  createdAt: string;
}

export interface StudentInGroup {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export const groupsApi = {
  getMyGroups: async () => {
    const res = await api.get<{ success: boolean; data: Group[] }>('/groups/my');
    return res.data.data;
  },
  
  createGroup: async (data: { name: string; code: string }) => {
    const res = await api.post<{ success: boolean; data: Group }>('/groups', data);
    return res.data.data;
  },
  
  getGroupStudents: async (id: string) => {
    const res = await api.get<{ success: boolean; data: any[] }>(`/groups/${id}/students`);
    return res.data.data;
  },
  getUnassignedStudents: async () => {
    const res = await api.get<{ success: boolean; data: any[] }>(`/groups/unassigned-students`);
    return res.data.data;
  },
  addStudent: async (groupId: string, studentId: string) => {
    const res = await api.post<{ success: boolean; data: any }>(`/groups/${groupId}/students`, { studentId });
    return res.data.data;
  },
  deleteGroup: async (id: string) => {
    const res = await api.delete<{ success: boolean }>(`/groups/${id}`);
    return res.data.success;
  }
};
