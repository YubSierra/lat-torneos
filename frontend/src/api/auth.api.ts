import api from './axios';

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  register: async (email: string, password: string, role = 'player') => {
    const res = await api.post('/auth/register', { email, password, role });
    return res.data;
  },
};