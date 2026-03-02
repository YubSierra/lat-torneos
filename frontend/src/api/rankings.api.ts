import api from './axios';

export const rankingsApi = {
  getByCategory: async (circuitLine: string, category: string) => {
    const res = await api.get(`/rankings/${circuitLine}/${category}`);
    return res.data;
  },

  getPlayerHistory: async (playerId: string) => {
    const res = await api.get(`/rankings/player/${playerId}/history`);
    return res.data;
  },
};