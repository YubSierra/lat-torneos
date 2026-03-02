import api from './axios';

export const courtsApi = {
  getAll: async () => {
    const res = await api.get('/courts');
    return res.data;
  },

  create: async (data: any) => {
    const res = await api.post('/courts', data);
    return res.data;
  },

  update: async (id: string, data: any) => {
    const res = await api.patch(`/courts/${id}`, data);
    return res.data;
  },

  generateSchedule: async (tournamentId: string, date: string) => {
    const res = await api.post(`/tournaments/${tournamentId}/schedule`, { date });
    return res.data;
  },

  getSchedule: async (tournamentId: string) => {
    const res = await api.get(`/tournaments/${tournamentId}/schedule`);
    return res.data;
  },
};