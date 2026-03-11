// frontend/src/api/tournaments.api.ts  ← REEMPLAZA COMPLETO
import api from './axios';

export const tournamentsApi = {
  // Admin: trae TODOS incluyendo borradores (requiere auth)
  getAll: async () => {
    const res = await api.get('/tournaments');
    return res.data;
  },

  // Público: filtra borradores — sin auth
  getPublic: async () => {
    const res = await api.get('/tournaments/public');
    return res.data;
  },

  getOne: async (id: string) => {
    const res = await api.get(`/tournaments/${id}`);
    return res.data;
  },

  create: async (data: any) => {
    const res = await api.post('/tournaments', data);
    return res.data;
  },

  update: async (id: string, data: any) => {
    const res = await api.patch(`/tournaments/${id}`, data);
    return res.data;
  },

  getSchedule: async (id: string) => {
    const res = await api.get(`/tournaments/${id}/schedule`);
    return res.data;
  },

  generateDraw: async (
    id: string,
    category: string,
    type: string,
    advancingPerGroup = 1,
    modality = 'singles',
    roundGameFormats = {},
    includeReserved = false,
    minPlayersPerGroup = 3,
  ) => {
    const res = await api.post(`/tournaments/${id}/draw`, {
      category,
      type,
      advancingPerGroup,
      modality,
      roundGameFormats,
      includeReserved,
      minPlayersPerGroup,
    });
    return res.data;
  },
};