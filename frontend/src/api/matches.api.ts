import api from './axios';

export const matchesApi = {
  getByTournament: async (tournamentId: string) => {
    const res = await api.get(`/matches/tournament/${tournamentId}`);
    return res.data;
  },

  getByCategory: async (tournamentId: string, category: string) => {
    const res = await api.get(`/matches/tournament/${tournamentId}/category/${category}`);
    return res.data;
  },

  startMatch: async (matchId: string) => {
    const res = await api.patch(`/matches/${matchId}/start`);
    return res.data;
  },

  updateScore: async (matchId: string, data: any) => {
    const res = await api.patch(`/matches/${matchId}/score`, data);
    return res.data;
  },

  declareWalkover: async (matchId: string, winnerId: string) => {
    const res = await api.patch(`/matches/${matchId}/walkover`, { winnerId });
    return res.data;
  },
};