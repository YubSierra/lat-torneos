// frontend/src/pages/Matches.tsx  ← REEMPLAZA COMPLETO
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play, Trophy, CloudRain, RefreshCw } from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { matchesApi }     from '../api/matches.api';
import { useSocket }      from '../hooks/useSocket';
import { useAuth }        from '../context/AuthContext';
import Sidebar            from '../components/Sidebar';
import WOModal            from '../components/WOModal';
import SuspendModal       from '../components/SuspendModal';

// ── Labels de rondas ─────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  R64: '64avos', R32: '32avos', R16: '16avos',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
  SF_M: 'SF Máster', F_M: 'Final Máster',
};

// ── Tipos ────────────────────────────────────────────────────────────────────
interface WOModalState {
  isOpen: boolean;
  match: {
    id: string; player1Id: string; player2Id: string;
    player1Name: string; player2Name: string;
    round: string; category: string;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Matches() {
  const { isAdmin, role } = useAuth();
  const navigate          = useNavigate();
  const queryClient       = useQueryClient();

  // Árbitro también puede iniciar, scorer y suspender
  const isReferee = role === 'referee';
  const canAct    = isAdmin || isReferee;

  const [selectedTournament, setSelectedTournament] = useState('');
  const [woModal,      setWoModal]      = useState<WOModalState>({ isOpen: false, match: null });
  const [suspendModal, setSuspendModal] = useState<{ isOpen: boolean; match: any | null }>({ isOpen: false, match: null });
  const [showSuspended, setShowSuspended] = useState(false);

  const { scores, startMatch: socketStart } = useSocket(selectedTournament);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const { data: matches = [], refetch } = useQuery({
    queryKey: ['matches', selectedTournament],
    queryFn: () => matchesApi.getByTournament(selectedTournament),
    enabled: !!selectedTournament,
  });

  const { data: suspendedExtra = [], refetch: refetchSuspended } = useQuery({
    queryKey: ['suspended', selectedTournament],
    queryFn: () => matchesApi.getSuspended(selectedTournament),
    enabled: !!selectedTournament && showSuspended,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const suspendMutation = useMutation({
    mutationFn: ({ matchId, reason, resumeDate }: { matchId: string; reason: string; resumeDate?: string }) =>
      matchesApi.suspendMatch(matchId, reason, resumeDate),
    onSuccess: () => {
      setSuspendModal({ isOpen: false, match: null });
      refetch();
      refetchSuspended();
      queryClient.invalidateQueries({ queryKey: ['matches', selectedTournament] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (matchId: string) => matchesApi.resumeMatch(matchId),
    onSuccess: () => { refetch(); refetchSuspended(); },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartMatch = async (matchId: string) => {
    await matchesApi.startMatch(matchId);
    socketStart(matchId);
    refetch();
  };

  const handleWOClick = (m: any) => setWoModal({
    isOpen: true,
    match: {
      id: m.id, player1Id: m.player1Id, player2Id: m.player2Id,
      player1Name: m.player1Name || 'Jugador 1',
      player2Name: m.player2Name || 'Jugador 2',
      round: m.round, category: m.category,
    },
  });

  const handleWOConfirm = async (matchId: string, winnerId: string) => {
    await matchesApi.declareWalkover(matchId, winnerId);
    setWoModal({ isOpen: false, match: null });
    refetch();
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  const liveMatches    = (matches as any[]).filter(m => m.status === 'live');
  const pendingMatches = (matches as any[]).filter(m => m.status === 'pending');
  const doneMatches    = (matches as any[]).filter(m => m.status === 'completed' || m.status === 'wo');
  const suspendedInList = (matches as any[]).filter(m => m.status === 'suspended');

  // ── Helper badge ──────────────────────────────────────────────────────────
  const badge = (bg: string, color: string, text: string) => (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: bg, color }}>
      {text}
    </span>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main className="flex-1 p-8">

        {/* Header */}
        <div className="mb-8" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <h1 className="text-2xl font-bold text-lat-dark">Partidos</h1>
            <p className="text-gray-500">Marcadores en tiempo real</p>
          </div>
          {isReferee && !isAdmin && (
            <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: '700' }}>
              🎾 Modo Árbitro
            </span>
          )}
        </div>

        {/* Selector torneo */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Torneo</label>
          <select
            value={selectedTournament}
            onChange={e => { setSelectedTournament(e.target.value); setShowSuspended(false); }}
            style={{ border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', minWidth: '300px' }}
          >
            <option value="">Seleccionar torneo...</option>
            {(tournaments as any[]).map((t: any) => (
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

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 🔴 EN VIVO                                                    */}
            {/* ══════════════════════════════════════════════════════════════ */}
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
                      <div key={m.id} style={{ border: '2px solid #EF4444', borderRadius: '12px', padding: '16px', backgroundColor: '#FFF5F5' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>

                          {/* Info */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                              {badge('#F3E8FF', '#6B21A8', ROUND_LABELS[m.round] || m.round)}
                              {badge('#DBEAFE', '#1D4ED8', m.category)}
                              {m.courtName && badge('#F3F4F6', '#374151', `🎾 ${m.courtName}`)}
                            </div>
                            <p style={{ fontWeight: '700', color: '#1B3A1B', fontSize: '15px', margin: '2px 0' }}>{m.player1Name || 'BYE'}</p>
                            <p style={{ fontWeight: '700', color: '#1B3A1B', fontSize: '15px', margin: '2px 0' }}>{m.player2Name || 'BYE'}</p>
                          </div>

                          {/* Marcador */}
                          {liveScore && (
                            <div style={{ textAlign: 'center', padding: '0 16px' }}>
                              <div style={{ fontSize: '28px', fontWeight: '900', color: '#1B3A1B', lineHeight: 1.2 }}>{liveScore.games1}</div>
                              <div style={{ fontSize: '28px', fontWeight: '900', color: '#1B3A1B', lineHeight: 1.2 }}>{liveScore.games2}</div>
                            </div>
                          )}

                          {/* Acciones */}
                          {canAct && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button onClick={() => navigate(`/scorer/${m.id}`)} style={btnStyle('#EF4444', 'white')}>
                                📺 Scorer
                              </button>

                              {/* ⛈ SUSPENDER — visible para árbitro Y admin */}
                              <button
                                onClick={() => setSuspendModal({ isOpen: true, match: m })}
                                style={{ ...btnStyle('#FEF3C7', '#92400E'), border: '1.5px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '5px' }}
                              >
                                <CloudRain size={13} /> Suspender
                              </button>

                              {/* W.O. solo admin */}
                              {isAdmin && (
                                <button onClick={() => handleWOClick(m)} style={btnStyle('#F3F4F6', '#374151')}>
                                  W.O.
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ⛈ SUSPENDIDOS                                                 */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {suspendedInList.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⛈ Suspendidos
                    <span style={{ backgroundColor: '#F97316', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
                      {suspendedInList.length}
                    </span>
                  </h2>
                  <button
                    onClick={() => setShowSuspended(v => !v)}
                    style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#6B7280' }}
                  >
                    {showSuspended ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {suspendedInList.map((m: any) => (
                    <div key={m.id} style={{
                      border: '2px solid #FDE68A', borderRadius: '10px',
                      padding: '12px 16px', backgroundColor: '#FFFBEB',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
                    }}>
                      <div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                          {badge('#F3E8FF', '#6B21A8', ROUND_LABELS[m.round] || m.round)}
                          {badge('#DBEAFE', '#1D4ED8', m.category)}
                          {m.suspensionReason && (
                            <span style={{ fontSize: '11px', color: '#92400E', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              · {m.suspensionReason}
                            </span>
                          )}
                        </div>
                        <p style={{ fontWeight: '600', color: '#1B3A1B', fontSize: '13px', margin: 0 }}>
                          {m.player1Name} <span style={{ color: '#9CA3AF' }}>vs</span> {m.player2Name}
                        </p>
                        {m.partialResult && (
                          <p style={{ fontSize: '11px', color: '#F97316', fontWeight: '700', margin: '3px 0 0' }}>
                            Parcial: {m.partialResult.sets1}–{m.partialResult.sets2}
                          </p>
                        )}
                      </div>

                      {canAct && (
                        <button
                          onClick={() => resumeMutation.mutate(m.id)}
                          disabled={resumeMutation.isPending}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#F0FDF4', color: '#15803D', border: '1.5px solid #86EFAC', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                        >
                          <RefreshCw size={13} /> Reanudar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ⏳ PENDIENTES                                                  */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-bold text-lat-dark mb-4">
                ⏳ Pendientes ({pendingMatches.length})
              </h2>

              {pendingMatches.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No hay partidos pendientes</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB' }}>
                        {['Ronda', 'Categoría', 'Jugador 1', 'Jugador 2', 'Hora', ...(canAct ? ['Acciones'] : [])].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '9px 12px', color: '#6B7280', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMatches.map((m: any, i: number) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                          <td style={{ padding: '9px 12px' }}>{badge('#F3E8FF', '#6B21A8', ROUND_LABELS[m.round] || m.round)}</td>
                          <td style={{ padding: '9px 12px' }}>{badge('#DBEAFE', '#1D4ED8', m.category)}</td>
                          <td style={{ padding: '9px 12px', fontWeight: '600', color: '#1B3A1B' }}>{m.player1Name || 'BYE'}</td>
                          <td style={{ padding: '9px 12px', fontWeight: '600', color: '#1B3A1B' }}>{m.player2Name || 'BYE'}</td>
                          <td style={{ padding: '9px 12px', color: '#9CA3AF', fontSize: '12px' }}>
                            {m.scheduledAt
                              ? new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          {canAct && (
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>

                                {/* Iniciar — árbitro y admin */}
                                <button onClick={() => handleStartMatch(m.id)}
                                  style={{ ...btnStyle('#2D6A2D', 'white'), display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Play size={12} /> Iniciar
                                </button>

                                {/* Scorer */}
                                <button onClick={() => navigate(`/scorer/${m.id}`)}
                                  style={btnStyle('#EF4444', 'white')}>
                                  📺 Scorer
                                </button>

                                {/* ⛈ SUSPENDER — árbitro Y admin */}
                                <button
                                  onClick={() => setSuspendModal({ isOpen: true, match: m })}
                                  style={{ ...btnStyle('#FEF3C7', '#92400E'), border: '1.5px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <CloudRain size={12} /> Suspender
                                </button>

                                {/* W.O. — solo admin */}
                                {isAdmin && (
                                  <button onClick={() => handleWOClick(m)} style={btnStyle('#F3F4F6', '#374151')}>
                                    W.O.
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ✅ TERMINADOS                                                  */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-lat-dark mb-4">
                ✅ Terminados ({doneMatches.length})
              </h2>

              {doneMatches.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No hay partidos terminados</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB' }}>
                        {['Ronda', 'Categoría', 'Jugador 1', 'Jugador 2', 'Ganador', 'Estado'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '9px 12px', color: '#6B7280', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doneMatches.map((m: any, i: number) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                          <td style={{ padding: '9px 12px' }}>{badge('#F3E8FF', '#6B21A8', ROUND_LABELS[m.round] || m.round)}</td>
                          <td style={{ padding: '9px 12px' }}>{badge('#DBEAFE', '#1D4ED8', m.category)}</td>
                          <td style={{ padding: '9px 12px', color: '#6B7280' }}>{m.player1Name || 'BYE'}</td>
                          <td style={{ padding: '9px 12px', color: '#6B7280' }}>{m.player2Name || 'BYE'}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '700', color: '#15803D', fontSize: '13px' }}>
                              <Trophy size={13} color="#2D6A2D" /> {m.winnerName || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{
                              padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: '600',
                              backgroundColor: m.status === 'wo' ? '#FEF3C7' : '#DCFCE7',
                              color:           m.status === 'wo' ? '#92400E' : '#15803D',
                            }}>
                              {m.status === 'wo' ? '🏳️ W.O.' : '✓ Terminado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </>
        )}
      </main>

      {/* ── Modal W.O. ─────────────────────────────────────────────────────── */}
      <WOModal
        isOpen={woModal.isOpen}
        match={woModal.match}
        onConfirm={handleWOConfirm}
        onCancel={() => setWoModal({ isOpen: false, match: null })}
      />

      {/* ── Modal Suspender partido ────────────────────────────────────────── */}
      <SuspendModal
        isOpen={suspendModal.isOpen}
        mode="match"
        match={suspendModal.match}
        onConfirm={(reason, resumeDate) => {
          if (!suspendModal.match) return;
          suspendMutation.mutate({ matchId: suspendModal.match.id, reason, resumeDate });
        }}
        onCancel={() => setSuspendModal({ isOpen: false, match: null })}
        isLoading={suspendMutation.isPending}
      />
    </div>
  );
}

// ── Estilo reutilizable para botones de acción ────────────────────────────────
const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  backgroundColor: bg, color, border: 'none',
  padding: '5px 10px', borderRadius: '6px',
  cursor: 'pointer', fontSize: '11px', fontWeight: '600',
});
