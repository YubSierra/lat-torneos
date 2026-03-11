// frontend/src/api/publicApi.ts  ← ARCHIVO NUEVO
// Instancia de axios para endpoints PÚBLICOS (sin token, sin redirección al login)
// Usar en Landing, PublicTournament, LiveMatch — páginas que no requieren auth

import axios from 'axios';

const publicApi = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
});

export default publicApi;