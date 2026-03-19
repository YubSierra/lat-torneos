import api from './axios';

export interface CircuitRankingPoints {
  rrWinPoints: number;
  singles:  { champion: number; F: number; SF: number; QF: number; R16: number; R32: number; R64: number };
  doubles:  { champion: number; F: number; SF: number; QF: number; R16: number; R32: number; R64: number };
  master:   { champion: number; F_M: number; SF_M: number };
  merit:    { seed1: number; seed2: number; seeds34: number; seeds58: number };
}

export interface CircuitLineItem {
  id: string;
  slug: string;
  label: string;
  isDefault: boolean;
  rankingPoints: CircuitRankingPoints | null;
  customCategories: string[];
}

export const circuitLinesApi = {
  getAll: async (): Promise<CircuitLineItem[]> => {
    const res = await api.get('/circuit-lines');
    return res.data;
  },
  create: async (data: { slug: string; label: string; rankingPoints?: CircuitRankingPoints }) => {
    const res = await api.post('/circuit-lines', data);
    return res.data;
  },
  update: async (id: string, data: { label?: string; rankingPoints?: CircuitRankingPoints | null }) => {
    const res = await api.patch(`/circuit-lines/${id}`, data);
    return res.data;
  },
  remove: async (id: string) => {
    const res = await api.delete(`/circuit-lines/${id}`);
    return res.data;
  },
  addCategory: async (slug: string, category: string) => {
    const res = await api.post(`/circuit-lines/${slug}/categories`, { category });
    return res.data;
  },
  removeCategory: async (slug: string, category: string) => {
    const res = await api.delete(`/circuit-lines/${slug}/categories/${encodeURIComponent(category)}`);
    return res.data;
  },
};
