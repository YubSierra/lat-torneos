// frontend/src/api/mail.api.ts
import api from './axios';

export const mailApi = {
  /** Envía la programación (PDF adjunto) a los inscritos del torneo */
  sendSchedule: async (
    tournamentId: string,
    payload: {
      tournamentName: string;
      dateLabel: string;
      pdfBase64: string;
      filename: string;
      category?: string;
    },
  ): Promise<{ sent: number; total: number }> => {
    const res = await api.post(`/tournaments/${tournamentId}/mail/schedule`, payload);
    return res.data;
  },

  /** Envía el cuadro (PDF adjunto) a los inscritos de una categoría */
  sendDraw: async (
    tournamentId: string,
    payload: {
      tournamentName: string;
      category: string;
      pdfBase64?: string;
      filename?: string;
    },
  ): Promise<{ sent: number; total: number }> => {
    const res = await api.post(`/tournaments/${tournamentId}/mail/draw`, payload);
    return res.data;
  },
};
