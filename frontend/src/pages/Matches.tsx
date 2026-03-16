// frontend/src/pages/Matches.tsx  ← REEMPLAZA COMPLETO
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Play, Trophy, CloudRain, RefreshCw,
  X, BarChart2, Calendar, ChevronRight,
} from 'lucide-react';
import { tournamentsApi } from '../api/tournaments.api';
import { matchesApi }     from '../api/matches.api';
import { useSocket }      from '../hooks/useSocket';
import { useAuth }        from '../context/AuthContext';
import Sidebar            from '../components/Sidebar';
import PlayerAvatar       from '../components/PlayerAvatar';
import WOModal            from '../components/WOModal';
import SuspendModal       from '../components/SuspendModal';
import api                from '../api/axios';

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  R64: '64avos', R32: '32avos', R16: '16avos',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
  SF_M: 'SF Máster', F_M: 'Final Máster',
};

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  backgroundColor: bg, color, border: 'none',
  padding: '6px 12px', borderRadius: '7px',
  cursor: 'pointer', fontSize: '12px', fontWeight: '600',
  display: 'flex', alignItems: 'center', gap: '4px',
  whiteSpace: 'nowrap',
});

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface WOModalState {
  isOpen: boolean;
  match: {
    id: string; player1Id: string; player2Id: string;
    player1Name: string; player2Name: string;
    round: string; category: string;
  } | null;
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function Matches() {
  const { isAdmin, role } = useAuth();
  const navigate          = useNavigate();
  const queryClient       = useQueryClient();
  const isReferee = role === 'referee';
  const canAct    = isAdmin || isReferee;

  const [selectedTournament, setSelectedTournament] = useState('');
  const [woModal,       setWoModal]       = useState<WOModalState>({ isOpen: false, match: null });
  const [suspendModal,  setSuspendModal]  = useState<{ isOpen: boolean; match: any | null }>({ isOpen: false, match: null });
  const [showSuspended, setShowSuspended] = useState(false);
  const [editMatch,  setEditMatch]  = useState<any>(null);
  const [editSets1,  setEditSets1]  = useState('');
  const [editSets2,  setEditSets2]  = useState('');
  const [editGames1, setEditGames1] = useState('');
  const [editGames2, setEditGames2] = useState('');

  // ── Filtros de búsqueda ───────────────────────────────────────────────────
  const [filterName, setFilterName] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Panel lateral jugador
  const [playerPanel, setPlayerPanel] = useState<{
    id: string; name: string; photoUrl?: string; tournamentId: string;
  } | null>(null);
  const [playerTab, setPlayerTab] = useState<'torneo' | 'historial' | 'stats'>('torneo');

  const { scores, startMatch: socketStart } = useSocket(selectedTournament);

  // ── Queries ──────────────────────────────────────────────────────────────
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

  // Datos del panel del jugador
  const { data: playerStats } = useQuery({
    queryKey: ['player-stats', playerPanel?.id],
    queryFn: () => api.get(`/matches/player/${playerPanel!.id}/stats`).then(r => r.data),
    enabled: !!playerPanel?.id,
  });

  const { data: playerHistory } = useQuery({
    queryKey: ['player-ranking-history', playerPanel?.id],
    queryFn: () => api.get(`/rankings/player/${playerPanel!.id}/history`).then(r => r.data),
    enabled: !!playerPanel?.id,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const suspendMutation = useMutation({
    mutationFn: ({ matchId, reason, resumeDate }: any) =>
      matchesApi.suspendMatch(matchId, reason, resumeDate),
    onSuccess: () => {
      setSuspendModal({ isOpen: false, match: null });
      refetch(); refetchSuspended();
      queryClient.invalidateQueries({ queryKey: ['matches', selectedTournament] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (matchId: string) => matchesApi.resumeMatch(matchId),
    onSuccess: () => { refetch(); refetchSuspended(); },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
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

  const openPlayer = (id: string, name: string, photoUrl: string | undefined) => {
    if (!id) return;
    setPlayerPanel({ id, name, photoUrl, tournamentId: selectedTournament });
    setPlayerTab('torneo');
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  const liveMatches     = (matches as any[]).filter(m => m.status === 'live');
  const suspendedInList = (matches as any[]).filter(m => m.status === 'suspended');

  // Función de filtrado compartida por pendientes y terminados
  const applyFilters = (list: any[]) => {
    let result = list;
    if (filterName.trim()) {
      const q = filterName.trim().toLowerCase();
      result = result.filter(m =>
        (m.player1Name || '').toLowerCase().includes(q) ||
        (m.player2Name || '').toLowerCase().includes(q)
      );
    }
    if (filterDate) {
      result = result.filter(m => {
        if (!m.scheduledAt) return false;
        // Comparamos solo la parte de fecha YYYY-MM-DD
        return m.scheduledAt.slice(0, 10) === filterDate;
      });
    }
    return result;
  };

  const pendingMatches  = applyFilters((matches as any[]).filter(m => m.status === 'pending'));
  const doneMatches     = applyFilters((matches as any[]).filter(m => m.status === 'completed' || m.status === 'wo'));

  // ¿Hay algún filtro activo?
  const hasFilters = filterName.trim() !== '' || filterDate !== '';

  // Partidos del jugador seleccionado en el torneo actual
  const playerMatches = (matches as any[]).filter(
    m => m.player1Id === playerPanel?.id || m.player2Id === playerPanel?.id
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-lat-bg">
      <Sidebar />

      <main style={{ flex: 1, padding: '24px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1B3A1B', margin: 0 }}>🎾 Partidos</h1>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: '2px 0 0' }}>Marcadores en tiempo real</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isReferee && !isAdmin && (
              <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: '700' }}>
                🎖 Modo Árbitro
              </span>
            )}
            {liveMatches.length > 0 && (
              <span style={{
                backgroundColor: '#FEE2E2', color: '#DC2626',
                padding: '5px 14px', borderRadius: '999px',
                fontSize: '13px', fontWeight: '800',
                display: 'flex', alignItems: 'center', gap: '7px',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#DC2626', display: 'inline-block' }} />
                {liveMatches.length} en vivo
              </span>
            )}
          </div>
        </div>

        {/* ── Selector torneo ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm p-4" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={selectedTournament}
            onChange={e => {
              setSelectedTournament(e.target.value);
              setShowSuspended(false);
              setPlayerPanel(null);
            }}
            style={{
              border: '1.5px solid #E5E7EB', borderRadius: '8px',
              padding: '9px 14px', fontSize: '14px', minWidth: '320px',
              color: '#1B3A1B', fontWeight: '500',
            }}
          >
            <option value="">🏆 Seleccionar torneo...</option>
            {(tournaments as any[]).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Botón para compartir la página pública del torneo */}
          {selectedTournament && (
            <a
              href={`/torneo/${selectedTournament}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: '#1B3A1B', color: 'white',
                padding: '9px 16px', borderRadius: '8px',
                fontSize: '13px', fontWeight: '600',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              🌐 Ver página pública
            </a>
          )}
        </div>

        {!selectedTournament ? (
          <div className="bg-white rounded-xl shadow-sm" style={{ padding: '60px', textAlign: 'center' }}>
            <p style={{ fontSize: '48px', margin: '0 0 12px' }}>🎾</p>
            <p style={{ color: '#9CA3AF', fontSize: '15px' }}>Selecciona un torneo para ver los partidos</p>
          </div>
        ) : (
          <>
          {/* ── Barra de filtros ────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Icono */}
            <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: '600', whiteSpace: 'nowrap' }}>🔍 Filtrar:</span>

            {/* Nombre */}
            <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '280px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '13px', pointerEvents: 'none' }}>👤</span>
              <input
                type="text"
                placeholder="Buscar jugador..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1.5px solid #E5E7EB', borderRadius: '8px',
                  padding: '7px 10px 7px 30px', fontSize: '13px',
                  color: '#1B3A1B', outline: 'none',
                  backgroundColor: filterName ? '#F0FDF4' : 'white',
                  borderColor: filterName ? '#86EFAC' : '#E5E7EB',
                }}
              />
            </div>

            {/* Fecha */}
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                style={{
                  border: '1.5px solid #E5E7EB', borderRadius: '8px',
                  padding: '7px 12px', fontSize: '13px',
                  color: filterDate ? '#1B3A1B' : '#9CA3AF',
                  outline: 'none', cursor: 'pointer',
                  backgroundColor: filterDate ? '#F0FDF4' : 'white',
                  borderColor: filterDate ? '#86EFAC' : '#E5E7EB',
                }}
              />
            </div>

            {/* Limpiar */}
            {hasFilters && (
              <button
                onClick={() => { setFilterName(''); setFilterDate(''); }}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #FECACA', backgroundColor: '#FFF5F5', color: '#DC2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                ✕ Limpiar
              </button>
            )}

            {/* Contador de resultados */}
            {hasFilters && (
              <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: 'auto' }}>
                {pendingMatches.length + doneMatches.length} resultado{pendingMatches.length + doneMatches.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

            {/* ── Columna principal ────────────────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ═══════════════════════════════════════════════ EN VIVO ══ */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div style={{
                  padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    backgroundColor: liveMatches.length > 0 ? '#EF4444' : '#D1D5DB',
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1B3A1B', margin: 0 }}>En Vivo</h2>
                  <span style={{
                    backgroundColor: liveMatches.length > 0 ? '#FEE2E2' : '#F3F4F6',
                    color: liveMatches.length > 0 ? '#DC2626' : '#9CA3AF',
                    fontSize: '11px', fontWeight: '700', padding: '1px 9px', borderRadius: '999px',
                  }}>
                    {liveMatches.length}
                  </span>
                </div>

                <div style={{ padding: '16px' }}>
                  {liveMatches.length === 0 ? (
                    <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>
                      No hay partidos en vivo en este momento
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {liveMatches.map((m: any) => {
                        const ls   = scores[m.id];
                        // setsHistory puede llegar como string JSON desde el backend → parsearlo
                        const rawSets = ls?.sets || m.setsHistory;
                        const sets: any[] = Array.isArray(rawSets)
                          ? rawSets
                          : typeof rawSets === 'string'
                            ? (() => { try { return JSON.parse(rawSets); } catch { return []; } })()
                            : [];
                        return (
                          <LiveMatchCard
                            key={m.id}
                            m={m} ls={ls} sets={sets}
                            canAct={canAct} isAdmin={isAdmin}
                            onNavigate={navigate}
                            onSuspend={() => setSuspendModal({ isOpen: true, match: m })}
                            onWO={() => handleWOClick(m)}
                            onPlayerClick={openPlayer}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════ SUSPENDIDOS ══ */}
              {suspendedInList.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div style={{
                    padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CloudRain size={15} color="#92400E" />
                      <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#92400E', margin: 0 }}>Suspendidos</h2>
                      <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '11px', fontWeight: '700', padding: '1px 9px', borderRadius: '999px' }}>
                        {suspendedInList.length}
                      </span>
                    </div>
                    {canAct && (
                      <button
                        onClick={() => setShowSuspended(v => !v)}
                        style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#6B7280' }}
                      >
                        {showSuspended ? 'Ocultar' : 'Ver detalle'}
                      </button>
                    )}
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {suspendedInList.map((m: any) => (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '10px',
                        backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A',
                        gap: '10px', flexWrap: 'wrap',
                      }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', color: '#1B3A1B', fontWeight: '600' }}>
                            {m.player1Name} <span style={{ color: '#9CA3AF' }}>vs</span> {m.player2Name}
                          </span>
                          {m.suspendReason && (
                            <span style={{ fontSize: '11px', color: '#92400E', backgroundColor: '#FEF3C7', padding: '1px 7px', borderRadius: '999px' }}>
                              ⛈ {m.suspendReason}
                            </span>
                          )}
                        </div>
                        {canAct && (
                          <button
                            onClick={() => resumeMutation.mutate(m.id)}
                            disabled={resumeMutation.isPending}
                            style={btnStyle('#DCFCE7', '#15803D')}
                          >
                            <RefreshCw size={12} /> Reanudar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════ PENDIENTES ══ */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1B3A1B', margin: 0 }}>⏳ Pendientes</h2>
                  <span style={{ backgroundColor: '#FEF9C3', color: '#92400E', fontSize: '11px', fontWeight: '700', padding: '1px 9px', borderRadius: '999px' }}>
                    {pendingMatches.length}
                  </span>
                </div>

                <div>
                  {pendingMatches.length === 0 ? (
                    <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px', fontSize: '13px' }}>Sin partidos pendientes</p>
                  ) : (
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          {['Ronda', 'Categoría', 'Jugador 1', 'Jugador 2', 'Fecha', 'Hora', ...(canAct ? ['Acciones'] : [])].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: '#6B7280', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingMatches.map((m: any, i: number) => (
                          <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                            <td style={{ padding: '9px 14px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                                {ROUND_LABELS[m.round] || m.round}
                              </span>
                            </td>
                            <td style={{ padding: '9px 14px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                                {m.category}
                              </span>
                            </td>
                            <td style={{ padding: '9px 14px' }}>
                              <PlayerNameCell name={m.player1Name} photoUrl={m.player1PhotoUrl} playerId={m.player1Id} onClick={openPlayer} />
                            </td>
                            <td style={{ padding: '9px 14px' }}>
                              <PlayerNameCell name={m.player2Name} photoUrl={m.player2PhotoUrl} playerId={m.player2Id} onClick={openPlayer} />
                            </td>
                            {/* Fecha */}
                            <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                              {m.scheduledAt ? (
                                <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>
                                  📅 {new Date(m.scheduledAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#D1D5DB' }}>—</span>
                              )}
                            </td>
                            {/* Hora */}
                            <td style={{ padding: '9px 14px', color: '#6B7280', fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {m.scheduledAt
                                ? new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            {canAct && (
                              <td style={{ padding: '9px 14px' }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  <button onClick={() => handleStartMatch(m.id)} style={btnStyle('#2D6A2D', 'white')}><Play size={11} />Iniciar</button>
                                  <button onClick={() => navigate(`/scorer/${m.id}`)} style={btnStyle('#EF4444', 'white')}>📺</button>
                                  <button onClick={() => setSuspendModal({ isOpen: true, match: m })} style={{ ...btnStyle('#FEF3C7', '#92400E'), border: '1px solid #FDE68A' }}><CloudRain size={11} /></button>
                                  {isAdmin && <button onClick={() => handleWOClick(m)} style={btnStyle('#F3F4F6', '#374151')}>W.O.</button>}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════ TERMINADOS ══ */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1B3A1B', margin: 0 }}>✅ Terminados</h2>
                  <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: '700', padding: '1px 9px', borderRadius: '999px' }}>
                    {doneMatches.length}
                  </span>
                </div>

                <div>
                  {doneMatches.length === 0 ? (
                    <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px', fontSize: '13px' }}>Sin partidos terminados</p>
                  ) : (
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          {['Ronda', 'Cat.', 'Jugador 1', 'Jugador 2', 'Fecha', 'Resultado', 'Ganador', ...(isAdmin ? ['Acciones'] : [])].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: '#6B7280', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {doneMatches.map((m: any, i: number) => {
                          const p1Won  = m.winnerId === m.player1Id;
                          const mySets = `${m.sets1 ?? 0}–${m.sets2 ?? 0}`;
                          return (
                            <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                              <td style={{ padding: '9px 14px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                                  {ROUND_LABELS[m.round] || m.round}
                                </span>
                              </td>
                              <td style={{ padding: '9px 14px' }}>
                                <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: '600' }}>
                                  {m.category}
                                </span>
                              </td>
                              <td style={{ padding: '9px 14px' }}>
                                <PlayerNameCell
                                  name={m.player1Name} photoUrl={m.player1PhotoUrl}
                                  playerId={m.player1Id} onClick={openPlayer}
                                  dim={!p1Won} winner={p1Won}
                                />
                              </td>
                              <td style={{ padding: '9px 14px' }}>
                                <PlayerNameCell
                                  name={m.player2Name} photoUrl={m.player2PhotoUrl}
                                  playerId={m.player2Id} onClick={openPlayer}
                                  dim={p1Won} winner={!p1Won}
                                />
                              </td>
                              {/* Fecha */}
                              <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                                {m.scheduledAt ? (
                                  <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>
                                    📅 {new Date(m.scheduledAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#D1D5DB' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '9px 14px', fontWeight: '800', fontSize: '15px', color: '#1B3A1B', fontFamily: 'monospace' }}>
                                {m.status === 'wo'
                                  ? <span style={{ fontSize: '11px', color: '#92400E' }}>W.O.</span>
                                  : mySets}
                              </td>
                              <td style={{ padding: '9px 14px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '700', color: '#15803D', fontSize: '12px' }}>
                                <Trophy size={12} color="#2D6A2D" />
                                {m.winnerName || '—'}
                              </span>
                              </td>
                              {isAdmin && (
                                <td style={{ padding: '9px 14px' }}>
                                  <button
                                    onClick={() => {
                                      setEditMatch(m);
                                      setEditSets1(String(m.sets1 ?? ''));
                                      setEditSets2(String(m.sets2 ?? ''));
                                      setEditGames1(String(m.games1 ?? ''));
                                      setEditGames2(String(m.games2 ?? ''));
                                    }}
                                    style={{
                                      backgroundColor: '#EFF6FF', color: '#1D4ED8',
                                      border: '1px solid #BFDBFE', borderRadius: '6px',
                                      padding: '4px 8px', cursor: 'pointer',
                                      fontSize: '11px', fontWeight: '600',
                                    }}
                                  >
                                    ✏️ Editar
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>{/* /columna principal */}

            {/* ── Panel lateral jugador ────────────────────────────────────── */}
            {playerPanel && (
              <PlayerProfilePanel
                player={playerPanel}
                tab={playerTab}
                setTab={setPlayerTab}
                stats={playerStats}
                history={playerHistory}
                tournamentMatches={playerMatches}
                onClose={() => setPlayerPanel(null)}
              />
            )}

          </div>{/* /flex principal */}
          </>
        )}
      </main>

      <WOModal
        isOpen={woModal.isOpen} match={woModal.match}
        onConfirm={handleWOConfirm}
        onDoubleWO={async (matchId) => {
          try {
            await api.patch(`/matches/${matchId}/double-walkover`);
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            setWoModal({ isOpen: false, match: null });
          } catch {
            alert('Error al declarar Doble W.O.');
          }
        }}
        onCancel={() => setWoModal({ isOpen: false, match: null })}
      />
      <SuspendModal
        isOpen={suspendModal.isOpen} mode="match" match={suspendModal.match}
        onConfirm={(reason, resumeDate) => {
          if (!suspendModal.match) return;
          suspendMutation.mutate({ matchId: suspendModal.match.id, reason, resumeDate });
        }}
        onCancel={() => setSuspendModal({ isOpen: false, match: null })}
        isLoading={suspendMutation.isPending}
      />

      {/* ── Modal editar resultado ── */}
      {editMatch && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setEditMatch(null)}
        >
          <div
            style={{
              backgroundColor: 'white', borderRadius: '16px', padding: '28px',
              width: '420px', maxWidth: '95vw',
              maxHeight: '90vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>✏️ Editar Resultado</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              {ROUND_LABELS[editMatch.round] || editMatch.round} · {editMatch.category}
            </p>

            {/* Sets */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Sets</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>{editMatch.player1Name}</p>
                  <input
                    type="number" min="0" max="3" value={editSets1}
                    onChange={e => setEditSets1(e.target.value)}
                    style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center', width: '100%', maxWidth: '120px', boxSizing: 'border-box' }}
                  />
                </div>
                <span style={{ fontSize: '20px', color: '#9CA3AF', marginTop: '18px' }}>-</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>{editMatch.player2Name}</p>
                  <input
                    type="number" min="0" max="3" value={editSets2}
                    onChange={e => setEditSets2(e.target.value)}
                    style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center', width: '100%', maxWidth: '120px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Games último set */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Games (último set)</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>{editMatch.player1Name}</p>
                  <input
                    type="number" min="0" value={editGames1}
                    onChange={e => setEditGames1(e.target.value)}
                    style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center', width: '100%', maxWidth: '120px', boxSizing: 'border-box' }}
                  />
                </div>
                <span style={{ fontSize: '20px', color: '#9CA3AF', marginTop: '18px' }}>-</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>{editMatch.player2Name}</p>
                  <input
                    type="number" min="0" value={editGames2}
                    onChange={e => setEditGames2(e.target.value)}
                    style={{ border: '2px solid #D1D5DB', borderRadius: '8px', padding: '10px', fontSize: '20px', fontWeight: '700', textAlign: 'center', width: '100%', maxWidth: '120px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Ganador */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Ganador</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { id: editMatch.player1Id, name: editMatch.player1Name },
                  { id: editMatch.player2Id, name: editMatch.player2Name },
                ].map(p => {
                  const sel = editMatch._winnerId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setEditMatch({ ...editMatch, _winnerId: p.id })}
                      style={{
                        padding: '12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                        border: sel ? '2px solid #16A34A' : '2px solid #E5E7EB',
                        backgroundColor: sel ? '#F0FDF4' : '#F9FAFB',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '600', color: sel ? '#166534' : '#111827' }}>{p.name}</div>
                      {sel && <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700', marginTop: '4px' }}>🏆 GANA</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setEditMatch(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.patch(`/matches/${editMatch.id}/score`, {
                      sets1:    Number(editSets1),
                      sets2:    Number(editSets2),
                      games1:   Number(editGames1),
                      games2:   Number(editGames2),
                      winnerId: editMatch._winnerId,
                    });
                    queryClient.invalidateQueries({ queryKey: ['matches'] });
                    setEditMatch(null);
                  } catch {
                    alert('❌ Error al guardar resultado');
                  }
                }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #1D4ED8, #1E40AF)',
                  color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TARJETA PARTIDO EN VIVO — diseño tipo scoreboard profesional
// ═════════════════════════════════════════════════════════════════════════════
function LiveMatchCard({ m, ls, sets, canAct, isAdmin, onNavigate, onSuspend, onWO, onPlayerClick }: any) {
  const p1Sets   = ls?.sets1  ?? m.sets1  ?? 0;
  const p2Sets   = ls?.sets2  ?? m.sets2  ?? 0;
  const p1Games  = ls?.games1 ?? m.games1 ?? 0;
  const p2Games  = ls?.games2 ?? m.games2 ?? 0;
  const p1Points = ls?.points1 ?? m.points1;
  const p2Points = ls?.points2 ?? m.points2;
  const p1Winning = p1Sets > p2Sets || (p1Sets === p2Sets && p1Games > p2Games);
  const p2Winning = p2Sets > p1Sets || (p1Sets === p2Sets && p2Games > p1Games);

  // Parsear setsHistory de forma defensiva — el backend puede devolver
  // un string JSON, un array ya parseado, o null/undefined
  const parseSets = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  };

  const setsHistory: any[] = parseSets(sets || m.setsHistory);

  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(239,68,68,0.12)', border: '1.5px solid #FECACA' }}>

      {/* ── Cabecera verde oscuro ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)',
        padding: '11px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Punto rojo pulsante */}
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#EF4444', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>En Vivo</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: '#86EFAC', fontWeight: '700', fontSize: '12px' }}>{ROUND_LABELS[m.round] || m.round}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>{m.category}</span>
        </div>
        {m.courtName && (
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>🎾 {m.courtName}</span>
        )}
      </div>

      {/* ── Scoreboard ── */}
      <div style={{ backgroundColor: '#FAFAFA', padding: '0' }}>

        {/* Fila Jugador 1 */}
        <ScoreRow
          name={m.player1Name} photoUrl={m.player1PhotoUrl}
          sets={p1Sets} games={p1Games} points={p1Points}
          setsHistory={setsHistory.map((s: any) => ({ mine: s.games1, theirs: s.games2 }))}
          isWinning={p1Winning}
          onPlayerClick={() => onPlayerClick(m.player1Id, m.player1Name, m.player1PhotoUrl)}
        />

        {/* Separador */}
        <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0 16px' }} />

        {/* Fila Jugador 2 */}
        <ScoreRow
          name={m.player2Name} photoUrl={m.player2PhotoUrl}
          sets={p2Sets} games={p2Games} points={p2Points}
          setsHistory={setsHistory.map((s: any) => ({ mine: s.games2, theirs: s.games1 }))}
          isWinning={p2Winning}
          onPlayerClick={() => onPlayerClick(m.player2Id, m.player2Name, m.player2PhotoUrl)}
        />
      </div>

      {/* ── Historial de sets ── */}
      {setsHistory.length > 0 && (
        <div style={{ backgroundColor: 'white', borderTop: '1px solid #F3F4F6', padding: '12px 18px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Historial de sets
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {setsHistory.map((s: any, idx: number) => {
              const p1Won = s.games1 > s.games2;
              return (
                <div key={idx} style={{
                  backgroundColor: '#F9FAFB', borderRadius: '10px',
                  padding: '8px 14px', minWidth: '56px', textAlign: 'center',
                  border: '1px solid #E5E7EB',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#9CA3AF', fontWeight: '600' }}>Set {idx + 1}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: p1Won ? '#15803D' : '#374151', lineHeight: 1 }}>{s.games1}</span>
                    <span style={{ fontSize: '11px', color: '#D1D5DB' }}>–</span>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: !p1Won ? '#15803D' : '#374151', lineHeight: 1 }}>{s.games2}</span>
                  </div>
                  {(s.tiebreak1 !== undefined || s.tiebreak2 !== undefined) && (
                    <p style={{ margin: '3px 0 0', fontSize: '9px', color: '#9CA3AF' }}>
                      TB {s.tiebreak1 ?? 0}–{s.tiebreak2 ?? 0}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Acciones ── */}
      {canAct && (
        <div style={{ backgroundColor: 'white', borderTop: '1px solid #F3F4F6', padding: '12px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate(`/scorer/${m.id}`)} style={{ ...btnStyle('#EF4444', 'white'), padding: '8px 16px' }}>
            📺 Abrir Scorer
          </button>
          <button onClick={onSuspend} style={{ ...btnStyle('#FEF3C7', '#92400E'), border: '1px solid #FDE68A', padding: '8px 14px' }}>
            <CloudRain size={13} /> Suspender
          </button>
          {isAdmin && (
            <button onClick={onWO} style={{ ...btnStyle('#F3F4F6', '#374151'), padding: '8px 14px' }}>W.O.</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Fila de score de un jugador ───────────────────────────────────────────────
const PTS_LABEL: Record<string, string> = { '0': '0', '15': '15', '30': '30', '40': '40', 'A': 'Ad' };

function ScoreRow({ name, photoUrl, sets, games, points, setsHistory, isWinning, onPlayerClick }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 18px',
      backgroundColor: isWinning ? '#F0FDF4' : 'transparent',
      transition: 'background-color 0.3s',
    }}>

      {/* Avatar clickeable */}
      <button onClick={onPlayerClick} title="Ver perfil" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
        <PlayerAvatar
          name={name || '?'} photoUrl={photoUrl}
          size={52} borderColor={isWinning ? '#22C55E' : '#E5E7EB'}
        />
      </button>

      {/* Nombre + mini histórico de sets */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onPlayerClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '5px', maxWidth: '100%' }}>
          <span style={{
            fontWeight: isWinning ? '800' : '600',
            color: isWinning ? '#1B3A1B' : '#374151',
            fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {name || 'BYE'}
          </span>
          {isWinning && (
            <span style={{ fontSize: '10px', backgroundColor: '#DCFCE7', color: '#15803D', padding: '1px 7px', borderRadius: '999px', fontWeight: '800', flexShrink: 0 }}>
              GANA
            </span>
          )}
          <ChevronRight size={12} color="#9CA3AF" style={{ flexShrink: 0 }} />
        </button>

        {/* Sets anteriores en miniatura */}
        {setsHistory.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', marginTop: '3px' }}>
            {setsHistory.map((s: any, i: number) => (
              <span key={i} style={{
                fontSize: '12px', fontWeight: s.mine > s.theirs ? '800' : '400',
                color: s.mine > s.theirs ? '#15803D' : '#9CA3AF',
              }}>
                {s.mine}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sets ganados */}
      <div style={{ textAlign: 'center', minWidth: '32px' }}>
        <p style={{ margin: 0, fontSize: '10px', color: '#9CA3AF', fontWeight: '600' }}>Sets</p>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: isWinning ? '#15803D' : '#374151', lineHeight: 1.1 }}>
          {sets}
        </p>
      </div>

      {/* Games actuales */}
      <div style={{
        textAlign: 'center', minWidth: '52px',
        backgroundColor: isWinning ? '#DCFCE7' : '#F3F4F6',
        borderRadius: '12px', padding: '8px 10px',
      }}>
        <p style={{ margin: 0, fontSize: '10px', color: isWinning ? '#15803D' : '#9CA3AF', fontWeight: '600' }}>Games</p>
        <p style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: isWinning ? '#15803D' : '#1B3A1B', lineHeight: 1 }}>
          {games}
        </p>
      </div>

      {/* Puntos de game */}
      {(points !== undefined && points !== null) && (
        <div style={{
          textAlign: 'center', minWidth: '40px',
          backgroundColor: '#EDE9FE', borderRadius: '10px', padding: '7px 9px',
        }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#6D28D9', fontWeight: '600' }}>Pts</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#6D28D9', lineHeight: 1.1 }}>
            {PTS_LABEL[String(points)] ?? points}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Celda de jugador clicable (en tablas) ─────────────────────────────────────
function PlayerNameCell({ name, photoUrl, playerId, onClick, dim = false, winner = false }: any) {
  if (!playerId) return <span style={{ color: '#9CA3AF' }}>BYE</span>;
  return (
    <button
      onClick={() => onClick(playerId, name, photoUrl)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: '8px',
        opacity: dim ? 0.5 : 1,
      }}
    >
      <PlayerAvatar name={name || '?'} photoUrl={photoUrl} size={28} borderColor={winner ? '#22C55E' : undefined} />
      <span style={{ fontWeight: winner ? '700' : '500', color: winner ? '#1B3A1B' : '#374151', fontSize: '13px' }}>
        {name || 'BYE'}
      </span>
      {winner && <Trophy size={11} color="#2D6A2D" />}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PANEL LATERAL PERFIL JUGADOR
// ═════════════════════════════════════════════════════════════════════════════
function PlayerProfilePanel({ player, tab, setTab, stats, history, tournamentMatches, onClose }: any) {
  const winRate     = stats ? Math.round((stats.winRate ?? 0) * 100) : 0;
  const totalPoints = history?.totalPoints ?? 0;

  return (
    <div style={{
      width: '340px', flexShrink: 0,
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      position: 'sticky', top: '20px',
      maxHeight: 'calc(100vh - 100px)',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Header con foto ── */}
      <div style={{ background: 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)', padding: '22px 20px', position: 'relative', flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: '50%', width: '28px', height: '28px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} color="white" />
        </button>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={68} borderColor="rgba(255,255,255,0.5)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 8px', fontWeight: '800', color: 'white', fontSize: '16px', lineHeight: 1.2, paddingRight: '32px' }}>
              {player.name}
            </p>
            {stats && (
              <div style={{ display: 'flex', gap: '14px' }}>
                {[
                  { value: stats.wins ?? 0,   label: 'Victorias', color: '#86EFAC' },
                  { value: stats.losses ?? 0, label: 'Derrotas',  color: '#FCA5A5' },
                  { value: `${winRate}%`,     label: 'Win Rate',  color: '#FDE68A' },
                ].map(({ value, label, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color, lineHeight: 1 }}>{value}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.55)' }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Puntos escalafón */}
        {totalPoints > 0 && (
          <div style={{
            marginTop: '14px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <BarChart2 size={14} color="#FDE68A" />
            <span style={{ color: '#FDE68A', fontWeight: '800', fontSize: '13px' }}>{totalPoints} pts</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>escalafón · {history?.tournamentsPlayed ?? 0} torneos</span>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        {[
          { id: 'torneo',    label: '🏟 Torneo'   },
          { id: 'historial', label: '📜 Historial' },
          { id: 'stats',     label: '📊 Stats'     },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
            fontSize: '11px', fontWeight: '700',
            backgroundColor: tab === t.id ? 'white' : '#F9FAFB',
            color: tab === t.id ? '#1B3A1B' : '#9CA3AF',
            borderBottom: tab === t.id ? '2px solid #2D6A2D' : '2px solid transparent',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

        {/* ─── Tab: Este torneo ──────────────────────────────────────── */}
        {tab === 'torneo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tournamentMatches.length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>
                Sin partidos en este torneo
              </p>
            ) : tournamentMatches.map((m: any) => {
              const isP1    = m.player1Id === player.id;
              const oppName = isP1 ? m.player2Name : m.player1Name;
              const oppPhoto= isP1 ? m.player2PhotoUrl : m.player1PhotoUrl;
              const myWon   = m.winnerId === player.id;
              const isLive  = m.status === 'live';
              const isDone  = m.status === 'completed' || m.status === 'wo';
              const mySets  = (isP1 ? m.sets1 : m.sets2) ?? 0;
              const oppSets = (isP1 ? m.sets2 : m.sets1) ?? 0;

              return (
                <div key={m.id} style={{
                  padding: '11px 13px', borderRadius: '11px',
                  border: `1.5px solid ${isLive ? '#FECACA' : isDone && myWon ? '#86EFAC' : isDone ? '#FECACA' : '#E5E7EB'}`,
                  backgroundColor: isLive ? '#FFF8F8' : isDone && myWon ? '#F0FDF4' : isDone ? '#FFF5F5' : 'white',
                }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                      {ROUND_LABELS[m.round] || m.round}
                    </span>
                    <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '600', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                      {m.category}
                    </span>
                    {isLive && (
                      <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                        🔴 Vivo
                      </span>
                    )}
                  </div>

                  {/* Rival */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PlayerAvatar name={oppName || '?'} photoUrl={oppPhoto} size={30} />
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#374151' }}>vs {oppName || 'BYE'}</p>
                        {isDone && (
                          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: myWon ? '#15803D' : '#DC2626' }}>
                            {myWon ? '✓ Victoria' : '✗ Derrota'}{m.status === 'wo' ? ' (W.O.)' : ''}
                          </p>
                        )}
                        {!isDone && !isLive && (
                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>
                            {m.scheduledAt
                              ? new Date(m.scheduledAt).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : 'Por programar'}
                          </p>
                        )}
                      </div>
                    </div>
                    {isDone && (
                      <span style={{
                        fontSize: '16px', fontWeight: '900', fontFamily: 'monospace',
                        color: myWon ? '#15803D' : '#DC2626',
                      }}>
                        {mySets}–{oppSets}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Tab: Historial de torneos ─────────────────────────────── */}
        {tab === 'historial' && (
          <div>
            {!history ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>Cargando historial...</p>
            ) : (history?.history || []).length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>Sin historial de torneos aún</p>
            ) : (
              <>
                {/* Resumen */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { label: 'Puntos totales', value: totalPoints,                   color: '#15803D', bg: '#F0FDF4' },
                    { label: 'Torneos',        value: history.tournamentsPlayed ?? 0, color: '#1D4ED8', bg: '#EFF6FF' },
                    { label: 'Bonos méritos',  value: history.totalMeritBonus ?? 0,   color: '#92400E', bg: '#FEF3C7' },
                    { label: 'Temporada',      value: history.season ?? '—',          color: '#6D28D9', bg: '#EDE9FE' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ backgroundColor: bg, borderRadius: '12px', padding: '13px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color }}>{value}</p>
                      <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#6B7280', fontWeight: '600' }}>{label}</p>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                  Torneos jugados
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {(history.history as any[]).map((h: any) => (
                    <div key={h.id} style={{ padding: '11px 13px', borderRadius: '11px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: '#1B3A1B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {h.tournamentName}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7280' }}>
                            {h.category} · {h.circuitLine} · {h.roundReached}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={10} />
                            {new Date(h.createdAt).toLocaleDateString('es-CO')}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                          <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#15803D' }}>
                            {Number(h.totalPoints).toFixed(0)}
                          </p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#9CA3AF' }}>pts</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Tab: Estadísticas globales ───────────────────────────── */}
        {tab === 'stats' && (
          <div>
            {!stats ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>Cargando estadísticas...</p>
            ) : (
              <>
                {/* Barra win rate */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803D' }}>Victorias {winRate}%</span>
                    <span style={{ fontSize: '12px', color: '#DC2626' }}>Derrotas {100 - winRate}%</span>
                  </div>
                  <div style={{ height: '12px', borderRadius: '999px', backgroundColor: '#FEE2E2', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${winRate}%`,
                      background: 'linear-gradient(90deg, #2D6A2D, #4ADE80)',
                      borderRadius: '999px', transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                {/* Cards estadísticas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Total partidos', value: stats.totalMatches ?? 0, color: '#1D4ED8', bg: '#EFF6FF' },
                    { label: 'Victorias',      value: stats.wins ?? 0,         color: '#15803D', bg: '#F0FDF4' },
                    { label: 'Derrotas',       value: stats.losses ?? 0,       color: '#DC2626', bg: '#FEF2F2' },
                    { label: 'Win Rate',       value: `${winRate}%`,           color: '#92400E', bg: '#FEF3C7' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ backgroundColor: bg, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '28px', fontWeight: '900', color, lineHeight: 1 }}>{value}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#6B7280', fontWeight: '600' }}>{label}</p>
                    </div>
                  ))}
                </div>

                {stats.totalMatches === 0 && (
                  <p style={{ textAlign: 'center', fontSize: '12px', color: '#9CA3AF', marginTop: '16px' }}>
                    Sin partidos registrados aún
                  </p>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}