import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play, Trophy } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { matchesApi } from '../api/matches.api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

export default function Matches() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedTournament, setSelectedTournament] = useState('');

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

  const handleStartMatch = async (matchId: string) => {
    await matchesApi.startMatch(matchId);
    startMatch(matchId);
    refetch();
  };

  const handleWalkover = async (matchId: string, winnerId: string) => {
    await matchesApi.declareWalkover(matchId, winnerId);
    refetch();
  };

  const liveMatches  = matches.filter((m: any) => m.status === 'live');
  const pendingMatches = matches.filter((m: any) => m.status === 'pending');
  const doneMatches  = matches.filter((m: any) =>
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
          <p className="text-gray-400 text-center py-8">
            Selecciona un torneo para ver los partidos
          </p>
        ) : (
          <>
            {/* Partidos EN VIVO */}
            {liveMatches.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-bold text-red-600 mb-3 flex items-center gap-2">
                  🔴 En Vivo ({liveMatches.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveMatches.map((m: any) => {
                    const liveScore = scores[m.id];
                    return (
                      <div key={m.id} style={{
                        backgroundColor: 'white', borderRadius: '12px',
                        padding: '20px', border: '2px solid #EF4444',
                        boxShadow: '0 0 15px rgba(239,68,68,0.2)',
                      }}>
                        {/* Ronda y categoría */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px',
                            fontSize: '11px', fontWeight: '600',
                            backgroundColor: '#F3E8FF', color: '#6B21A8',
                          }}>
                            {ROUND_LABELS[m.round] || m.round}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px',
                            fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8',
                          }}>
                            {m.category}
                          </span>
                        </div>

                        {/* Marcador */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '2px' }}>Jugador 1</p>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#1B3A1B' }}>
                              {m.player1Name || 'BYE'}
                            </p>
                          </div>

                          <div style={{ textAlign: 'center', padding: '0 16px' }}>
                            <div style={{
                              display: 'flex', gap: '12px', alignItems: 'center',
                              fontSize: '32px', fontWeight: 'bold', color: '#1B3A1B',
                            }}>
                              <span>{liveScore?.sets1 ?? 0}</span>
                              <span style={{ fontSize: '20px', color: '#9CA3AF' }}>—</span>
                              <span>{liveScore?.sets2 ?? 0}</span>
                            </div>
                            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                              {liveScore?.games1 ?? 0} - {liveScore?.games2 ?? 0} games
                            </p>
                            <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                              {liveScore?.points1 ?? '0'} - {liveScore?.points2 ?? '0'} pts
                            </p>
                          </div>

                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '2px' }}>Jugador 2</p>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#1B3A1B' }}>
                              {m.player2Name || 'BYE'}
                            </p>
                          </div>
                        </div>

                        {/* Botón scorer */}
                        {isAdmin && (
                          <button
                            onClick={() => navigate(`/scorer/${m.id}`)}
                            style={{
                              marginTop: '12px', width: '100%',
                              backgroundColor: '#EF4444', color: 'white',
                              padding: '8px', borderRadius: '8px',
                              border: 'none', cursor: 'pointer', fontSize: '13px',
                            }}
                          >
                            Scorer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Partidos PENDIENTES */}
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
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px',
                            fontSize: '11px', fontWeight: '600',
                            backgroundColor: '#F3E8FF', color: '#6B21A8',
                          }}>
                            {ROUND_LABELS[m.round] || m.round}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px',
                            fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8',
                          }}>
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
                              <button
                                onClick={() => {
                                  if (confirm('¿Declarar W.O.? El jugador 1 gana 6-0 6-0')) {
                                    handleWalkover(m.id, m.player1Id);
                                  }
                                }}
                                style={{
                                  backgroundColor: '#FEF3C7', color: '#92400E',
                                  padding: '4px 8px', borderRadius: '6px',
                                  border: 'none', cursor: 'pointer', fontSize: '11px',
                                }}
                              >
                                W.O.
                              </button>
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

            {/* Partidos TERMINADOS */}
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
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px',
                            fontSize: '11px', fontWeight: '600',
                            backgroundColor: '#F3E8FF', color: '#6B21A8',
                          }}>
                            {ROUND_LABELS[m.round] || m.round}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px',
                            fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8',
                          }}>
                            {m.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {m.player1Name || 'BYE'}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {m.player2Name || 'BYE'}
                        </td>
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
                            {m.status === 'wo' ? 'W.O.' : '✓ Terminado'}
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

    </div>
  );
}