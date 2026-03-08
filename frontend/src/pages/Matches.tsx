// frontend/src/pages/Matches.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play, Trophy } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { matchesApi } from '../api/matches.api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import WOModal from '../components/WOModal';  // ← NUEVO

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

// ── Tipo para el estado del modal ────────────────────────────────────────────
// Guardamos todo el partido que necesita el modal
interface WOModalState {
  isOpen: boolean;
  match: {
    id: string;
    player1Id: string;
    player2Id: string;
    player1Name: string;
    player2Name: string;
    round: string;
    category: string;
  } | null;
}

export default function Matches() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedTournament, setSelectedTournament] = useState('');

  // Estado del modal W.O.
  const [woModal, setWoModal] = useState<WOModalState>({ isOpen: false, match: null });

  const { scores, startMatch } = useSocket(selectedTournament);

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const { data: matches = [], refetch } = useQuery({
    queryKey: ['matches', selectedTournament],
    queryFn: () => matchesApi.getByTournament(selectedTournament),
    enabled: !!selectedTournament,
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStartMatch = async (matchId: string) => {
    await matchesApi.startMatch(matchId);
    startMatch(matchId);
    refetch();
  };

  // Abre el modal W.O. pasándole los datos del partido
  const handleWOClick = (m: any) => {
    setWoModal({
      isOpen: true,
      match: {
        id:          m.id,
        player1Id:   m.player1Id,
        player2Id:   m.player2Id,
        player1Name: m.player1Name || 'Jugador 1',
        player2Name: m.player2Name || 'Jugador 2',
        round:       m.round,
        category:    m.category,
      },
    });
  };

  // Se llama cuando el árbitro confirma el W.O. en el modal
  const handleWOConfirm = async (matchId: string, winnerId: string, reason: string) => {
    try {
      await matchesApi.declareWalkover(matchId, winnerId);
      setWoModal({ isOpen: false, match: null });
      refetch();
    } catch (error) {
      console.error('Error al declarar W.O.:', error);
      // Aquí puedes agregar una notificación de error en el futuro
    }
  };

  const liveMatches    = matches.filter((m: any) => m.status === 'live');
  const pendingMatches = matches.filter((m: any) => m.status === 'pending');
  const doneMatches    = matches.filter((m: any) =>
    m.status === 'completed' || m.status === 'wo'
  );

  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-lat-dark">Partidos en Vivo</h1>
          <p className="text-gray-500">Marcadores en tiempo real</p>
        </div>

        {/* Selector torneo */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Torneo
          </label>
          <select
            value={selectedTournament}
            onChange={e => setSelectedTournament(e.target.value)}
            style={{
              border: '1px solid #D1D5DB', borderRadius: '8px',
              padding: '8px 12px', fontSize: '14px', minWidth: '300px',
            }}
          >
            <option value="">Seleccionar torneo...</option>
            {tournaments.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {!selectedTournament ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg">Selecciona un torneo para ver los partidos</p>
          </div>
        ) : (
          <>
            {/* ── Partidos EN VIVO ── */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-bold text-lat-dark mb-4">
                🔴 En Vivo ({liveMatches.length})
              </h2>
              {liveMatches.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No hay partidos en vivo</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {liveMatches.map((m: any) => {
                    const liveScore = scores[m.id];
                    return (
                      <div
                        key={m.id}
                        style={{
                          border: '2px solid #EF4444', borderRadius: '12px',
                          padding: '16px', backgroundColor: '#FFF5F5',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                                {ROUND_LABELS[m.round] || m.round}
                              </span>
                              <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                                {m.category}
                              </span>
                            </div>
                            <p className="font-semibold text-lat-dark">{m.player1Name || 'BYE'}</p>
                            <p className="font-semibold text-lat-dark">{m.player2Name || 'BYE'}</p>
                          </div>
                          {liveScore && (
                            <div style={{ textAlign: 'right', fontSize: '24px', fontWeight: '800', color: '#1B3A1B' }}>
                              <div>{liveScore.games1}</div>
                              <div>{liveScore.games2}</div>
                            </div>
                          )}
                          <button
                            onClick={() => navigate(`/scorer/${m.id}`)}
                            style={{
                              backgroundColor: '#EF4444', color: 'white',
                              padding: '8px 16px', borderRadius: '8px',
                              border: 'none', cursor: 'pointer', fontWeight: '600',
                            }}
                          >
                            Scorer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Partidos PENDIENTES ── */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-bold text-lat-dark mb-4">
                ⏳ Pendientes ({pendingMatches.length})
              </h2>
              {pendingMatches.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No hay partidos pendientes</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Ronda</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Categoría</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 1</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 2</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Hora</th>
                      {isAdmin && <th className="text-left py-3 px-4 text-gray-500 font-medium">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingMatches.map((m: any, i: number) => (
                      <tr key={m.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4">
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                            {ROUND_LABELS[m.round] || m.round}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                            {m.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-lat-dark text-xs">
                          {m.player1Name || 'BYE'}
                        </td>
                        <td className="py-3 px-4 font-medium text-lat-dark text-xs">
                          {m.player2Name || 'BYE'}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {m.scheduledAt
                            ? new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4">
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {/* Botón Iniciar */}
                              <button
                                onClick={() => handleStartMatch(m.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  backgroundColor: '#2D6A2D', color: 'white',
                                  padding: '4px 8px', borderRadius: '6px',
                                  border: 'none', cursor: 'pointer', fontSize: '11px',
                                }}
                              >
                                <Play size={12} />
                                Iniciar
                              </button>

                              {/* ✅ Botón W.O. — ahora abre el modal */}
                              <button
                                onClick={() => handleWOClick(m)}
                                style={{
                                  backgroundColor: '#FEF3C7', color: '#92400E',
                                  padding: '4px 8px', borderRadius: '6px',
                                  border: 'none', cursor: 'pointer', fontSize: '11px',
                                  fontWeight: '600',
                                }}
                              >
                                W.O.
                              </button>

                              {/* Botón Scorer */}
                              <button
                                onClick={() => navigate(`/scorer/${m.id}`)}
                                style={{
                                  backgroundColor: '#EF4444', color: 'white',
                                  padding: '4px 10px', borderRadius: '6px',
                                  border: 'none', cursor: 'pointer', fontSize: '11px',
                                }}
                              >
                                Scorer
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Partidos TERMINADOS ── */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-lat-dark mb-4">
                ✅ Terminados ({doneMatches.length})
              </h2>
              {doneMatches.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No hay partidos terminados</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Ronda</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Categoría</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 1</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Jugador 2</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Ganador</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doneMatches.map((m: any, i: number) => (
                      <tr key={m.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4">
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                            {ROUND_LABELS[m.round] || m.round}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                            {m.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">{m.player1Name || 'BYE'}</td>
                        <td className="py-3 px-4 text-xs text-gray-600">{m.player2Name || 'BYE'}</td>
                        <td className="py-3 px-4">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                            <Trophy size={12} color="#2D6A2D" />
                            <span className="font-medium text-lat-green text-xs">
                              {m.winnerName || '—'}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px',
                            fontSize: '11px', fontWeight: '500',
                            backgroundColor: m.status === 'wo' ? '#FEF3C7' : '#DCFCE7',
                            color: m.status === 'wo' ? '#92400E' : '#15803D',
                          }}>
                            {m.status === 'wo' ? '🏳️ W.O.' : '✓ Terminado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Modal W.O. — se renderiza fuera del flujo normal ── */}
      <WOModal
        isOpen={woModal.isOpen}
        match={woModal.match}
        onConfirm={handleWOConfirm}
        onCancel={() => setWoModal({ isOpen: false, match: null })}
      />
    </div>
  );
}
