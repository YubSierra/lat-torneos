// frontend/src/api/auth.api.ts  ← REEMPLAZA COMPLETO
import api from './axios';

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  // Registro público — solo jugadores, role hardcodeado en backend
  registerPlayer: async (data: {
    email:     string;
    password:  string;
    nombres:   string;
    apellidos: string;
    telefono?: string;
    docNumber?: string;
    birthDate?: string;
    gender?:   string;
  }) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },

  // Registro admin — acepta cualquier rol (usado desde Players page)
  register: async (email: string, password: string, role = 'player') => {
    const res = await api.post('/auth/register/admin', { email, password, role });
    return res.data;
  },
};