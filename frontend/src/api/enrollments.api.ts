import api from './axios';

export const enrollmentsApi = {
  create: async (data: any) => {
    const res = await api.post('/enrollments', data);
    return res.data;
  },

  getByTournament: async (tournamentId: string) => {
    const res = await api.get(`/enrollments/tournament/${tournamentId}`);
    return res.data;
  },

  getByPlayer: async (playerId: string) => {
    const res = await api.get(`/enrollments/player/${playerId}`);
    return res.data;
  },

  countByCategory: async (tournamentId: string, category: string) => {
    const res = await api.get(`/enrollments/tournament/${tournamentId}/category/${category}/count`);
    return res.data;
  },
};