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

  declareDoubleWalkover: async (matchId: string) => {
    const res = await api.patch(`/matches/${matchId}/double-walkover`);
    return res.data;
  },

  rescheduleMatch: async (matchId: string, data: {
    scheduledAt: string;   // ISO: "2026-03-22T14:15:00"
    courtId?: string;
    estimatedDuration?: number;
    notes?: string;
  }) => {
    const [date, timePart] = data.scheduledAt.split('T');
    const time = timePart?.slice(0, 5) ?? '09:00'; // "HH:MM"
    const res = await api.patch(`/matches/${matchId}/reschedule`, {
      date,
      time,
      courtId: data.courtId,
      duration: data.estimatedDuration ?? 90,
    });
    return res.data;
  },

  // ── SUSPENSIÓN ────────────────────────────────────

  /** Suspender un partido individual */
  suspendMatch: async (
    matchId: string,
    reason: string,
    resumeScheduledAt?: string,
    partialResult?: { sets1: number; sets2: number; games1: number; games2: number } | null,
  ) => {
    const res = await api.patch(`/matches/${matchId}/suspend`, { reason, resumeScheduledAt, partialResult });
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

  // ── ALTERNOS ──────────────────────────────────────

  /** BYEs disponibles en el cuadro (slots vacíos sin programar) */
  getByesForCategory: async (tournamentId: string, category: string) => {
    const res = await api.get(`/matches/tournament/${tournamentId}/byes/${encodeURIComponent(category)}`);
    return res.data;
  },

  /** Partidos pendientes de un jugador (para verificar retiro) */
  getPendingMatchesForPlayer: async (tournamentId: string, playerId: string, category: string) => {
    const res = await api.get(
      `/matches/tournament/${tournamentId}/pending-player/${playerId}/${encodeURIComponent(category)}`
    );
    return res.data;
  },

  /** Asignar alterno a un BYE del cuadro */
  assignAlternateToBye: async (
    tournamentId: string,
    matchId: string,
    alternatePlayerId: string,
    category: string,
  ) => {
    const res = await api.post(
      `/matches/tournament/${tournamentId}/assign-alternate-bye`,
      { matchId, alternatePlayerId, category },
    );
    return res.data;
  },

  /** Reemplazar jugador retirado por un alterno */
  replaceRetiredPlayer: async (
    tournamentId: string,
    retiredPlayerId: string,
    alternatePlayerId: string,
    category: string,
  ) => {
    const res = await api.post(
      `/matches/tournament/${tournamentId}/replace-retired`,
      { retiredPlayerId, alternatePlayerId, category },
    );
    return res.data;
  },
};