// frontend/src/api/matches.api.ts  ← REEMPLAZA COMPLETO
import api from './axios';

export const matchesApi = {

  // ── BÁSICO ────────────────────────────────────────
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

  rescheduleMatch: async (matchId: string, data: {
    scheduledAt: string;
    courtId?: string;
    estimatedDuration?: number;
    notes?: string;
  }) => {
    const res = await api.patch(`/matches/${matchId}/reschedule`, data);
    return res.data;
  },

  // ── SUSPENSIÓN ────────────────────────────────────

  /** Suspender un partido individual */
  suspendMatch: async (matchId: string, reason: string, resumeScheduledAt?: string) => {
    const res = await api.patch(`/matches/${matchId}/suspend`, { reason, resumeScheduledAt });
    return res.data;
  },

  /** Reanudar un partido suspendido */
  resumeMatch: async (matchId: string, newScheduledAt?: string) => {
    const res = await api.patch(`/matches/${matchId}/resume`, { newScheduledAt });
    return res.data;
  },

  /** Suspender toda la jornada de un torneo en una fecha */
  suspendDay: async (
    tournamentId: string,
    date: string,
    reason: string,
    resumeScheduledAt?: string,
  ) => {
    const res = await api.patch(
      `/matches/tournament/${tournamentId}/suspend-day`,
      { date, reason, resumeScheduledAt },
    );
    return res.data;
  },

  /** Reanudar toda la jornada suspendida (los partidos vuelven a PENDING sin fecha) */
  resumeDay: async (tournamentId: string, date: string) => {
    const res = await api.patch(
      `/matches/tournament/${tournamentId}/resume-day`,
      { date },
    );
    return res.data;
  },

  /** Listar partidos suspendidos de un torneo */
  getSuspended: async (tournamentId: string) => {
    const res = await api.get(`/matches/tournament/${tournamentId}/suspended`);
    return res.data;
  },

  /** Rondas pendientes (para selector de siguiente ronda a programar) */
  getPendingRounds: async (tournamentId: string) => {
    const res = await api.get(`/matches/tournament/${tournamentId}/pending-rounds`);
    return res.data;
  },

  /** Preview de programación sin guardar en BD */
  previewSchedule: async (tournamentId: string, body: any) => {
    const res = await api.post(
      `/tournaments/${tournamentId}/schedule/preview`,
      body,
    );
    return res.data;
  },
};