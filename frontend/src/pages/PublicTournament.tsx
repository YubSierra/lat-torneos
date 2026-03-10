// frontend/src/pages/PublicTournament.tsx  ← ARCHIVO NUEVO
// Página 100% pública — sin login — accesible en /torneo y /torneo/:tournamentId
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery }   from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { Trophy, ChevronRight, BarChart2, Calendar, X } from 'lucide-react';
import api            from '../api/axios';
import PlayerAvatar   from '../components/PlayerAvatar';

// ── Constantes ────────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  R64: '64avos', R32: '32avos', R16: '16avos',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
  SF_M: 'SF Máster', F_M: 'Final Máster',
};

const PTS_LABEL: Record<string, string> = {
  '0': '0', '15': '15', '30': '30', '40': '40', 'A': 'Ad',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface LiveScores {
  [matchId: string]: {
    sets1: number; sets2: number;
    games1: number; games2: number;
    points1: string; points2: string;
    sets?: { games1: number; games2: number; tiebreak1?: number; tiebreak2?: number }[];
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PÁGINA PÚBLICA
// ═════════════════════════════════════════════════════════════════════════════
export default function PublicTournament() {
  const { tournamentId: paramId } = useParams<{ tournamentId?: string }>();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState(paramId || '');
  const [scores, setScores]         = useState<LiveScores>({});
  const socketRef                   = useRef<Socket | null>(null);

  // Panel jugador
  const [playerPanel, setPlayerPanel] = useState<{
    id: string; name: string; photoUrl?: string;
  } | null>(null);
  const [playerTab, setPlayerTab] = useState<'torneo' | 'historial' | 'stats'>('torneo');

  // Sincronizar URL ↔ estado
  useEffect(() => {
    if (paramId) setSelectedId(paramId);
  }, [paramId]);

  // ── Socket en tiempo real ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;

    const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/matches`, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinTournament', { tournamentId: selectedId });
    });

    // Recibe actualizaciones de score del torneo
    socket.on('scoreUpdated', (data: any) => {
      setScores(prev => ({
        ...prev,
        [data.matchId]: {
          ...prev[data.matchId],
          ...data,
        },
      }));
    });

    // Recibe score detallado de un partido específico
    socket.on('liveScoreUpdated', (data: any) => {
      setScores(prev => ({
        ...prev,
        [data.matchId]: {
          sets1:   data.sets?.filter((s: any) => s.games1 > s.games2).length ?? 0,
          sets2:   data.sets?.filter((s: any) => s.games2 > s.games1).length ?? 0,
          games1:  data.currentGames1,
          games2:  data.currentGames2,
          points1: data.currentPoints1,
          points2: data.currentPoints2,
          sets:    data.sets,
        },
      }));
    });

    socket.on('matchLive', () => refetch());
    socket.on('walkoverdDeclared', () => refetch());

    return () => { socket.disconnect(); };
  }, [selectedId]);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const { data: tournaments = [] } = useQuery({
    queryKey: ['public-tournaments'],
    queryFn: () => api.get('/tournaments').then(r => r.data),
  });

  const { data: matches = [], refetch } = useQuery({
    queryKey: ['public-matches', selectedId],
    queryFn: () => api.get(`/matches/tournament/${selectedId}`).then(r => r.data),
    enabled: !!selectedId,
    refetchInterval: 30_000, // refresco cada 30s como fallback al socket
  });

  // Datos del jugador seleccionado
  const { data: playerStats } = useQuery({
    queryKey: ['pub-player-stats', playerPanel?.id],
    queryFn: () => api.get(`/matches/player/${playerPanel!.id}/stats`).then(r => r.data),
    enabled: !!playerPanel?.id,
  });
  const { data: playerHistory } = useQuery({
    queryKey: ['pub-player-history', playerPanel?.id],
    queryFn: () => api.get(`/rankings/player/${playerPanel!.id}/history`).then(r => r.data),
    enabled: !!playerPanel?.id,
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const tournament  = (tournaments as any[]).find((t: any) => t.id === selectedId);
  const liveMatches = (matches as any[]).filter((m: any) => m.status === 'live');

  const [filterName, setFilterName] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const applyFilters = (list: any[]) => {
    let r = list;
    if (filterName.trim()) {
      const q = filterName.trim().toLowerCase();
      r = r.filter((m: any) =>
        (m.player1Name || '').toLowerCase().includes(q) ||
        (m.player2Name || '').toLowerCase().includes(q)
      );
    }
    if (filterDate) {
      r = r.filter((m: any) => m.scheduledAt && m.scheduledAt.slice(0, 10) === filterDate);
    }
    return r;
  };

  const pendingMatches = applyFilters((matches as any[]).filter((m: any) => m.status === 'pending'));
  const doneMatches    = applyFilters((matches as any[]).filter((m: any) => m.status === 'completed' || m.status === 'wo'));
  const hasFilters     = filterName.trim() !== '' || filterDate !== '';

  const playerMatches = (matches as any[]).filter(
    (m: any) => m.player1Id === playerPanel?.id || m.player2Id === playerPanel?.id
  );

  const openPlayer = (id: string, name: string, photoUrl?: string) => {
    if (!id) return;
    setPlayerPanel({ id, name, photoUrl });
    setPlayerTab('torneo');
  };

  const handleTournamentChange = (id: string) => {
    setSelectedId(id);
    setPlayerPanel(null);
    if (id) navigate(`/torneo/${id}`, { replace: true });
    else    navigate('/torneo', { replace: true });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F3F4F6', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)', padding: '0 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>🎾</span>
            <div>
              <p style={{ margin: 0, fontWeight: '800', color: 'white', fontSize: '15px', lineHeight: 1 }}>LAT Torneos</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Liga de Tenis</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {liveMatches.length > 0 && (
              <span style={{ backgroundColor: '#EF4444', color: 'white', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'white', display: 'inline-block' }} />
                {liveMatches.length} en vivo
              </span>
            )}
            <a href="/login" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '7px' }}>
              Ingresar
            </a>
          </div>
        </div>
      </div>

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Selector torneo */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>🏆 Torneo:</span>
          <select
            value={selectedId}
            onChange={e => handleTournamentChange(e.target.value)}
            style={{ border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '8px 14px', fontSize: '14px', color: '#1B3A1B', fontWeight: '500', flex: 1, maxWidth: '400px', minWidth: '200px' }}
          >
            <option value="">Seleccionar torneo...</option>
            {(tournaments as any[]).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {tournament && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: '#DCFCE7', color: '#15803D' }}>
                {tournament.status}
              </span>
              {tournament.circuitLine && (
                <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: '#EDE9FE', color: '#6D28D9' }}>
                  {tournament.circuitLine}
                </span>
              )}
            </div>
          )}
        </div>

        {!selectedId ? (
          /* Pantalla vacía */
          <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '52px', margin: '0 0 14px' }}>🎾</p>
            <p style={{ color: '#374151', fontSize: '17px', fontWeight: '700', margin: '0 0 6px' }}>Bienvenido a LAT Torneos</p>
            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Selecciona un torneo para ver los partidos en tiempo real</p>
          </div>
        ) : (
          <>
          {/* ── Barra de filtros ────────────────────────────────────────────── */}
          <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: '600', whiteSpace: 'nowrap' }}>🔍 Filtrar:</span>

            {/* Nombre */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '280px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '13px', pointerEvents: 'none' }}>👤</span>
              <input
                type="text"
                placeholder="Buscar jugador..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: `1.5px solid ${filterName ? '#86EFAC' : '#E5E7EB'}`,
                  borderRadius: '8px', padding: '7px 10px 7px 30px', fontSize: '13px',
                  color: '#1B3A1B', outline: 'none',
                  backgroundColor: filterName ? '#F0FDF4' : 'white',
                }}
              />
            </div>

            {/* Fecha */}
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{
                border: `1.5px solid ${filterDate ? '#86EFAC' : '#E5E7EB'}`,
                borderRadius: '8px', padding: '7px 12px', fontSize: '13px',
                color: filterDate ? '#1B3A1B' : '#9CA3AF', outline: 'none', cursor: 'pointer',
                backgroundColor: filterDate ? '#F0FDF4' : 'white',
              }}
            />

            {/* Limpiar */}
            {hasFilters && (
              <button
                onClick={() => { setFilterName(''); setFilterDate(''); }}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #FECACA', backgroundColor: '#FFF5F5', color: '#DC2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                ✕ Limpiar
              </button>
            )}
            {hasFilters && (
              <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: 'auto' }}>
                {pendingMatches.length + doneMatches.length} resultado{pendingMatches.length + doneMatches.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

            {/* ── Columna principal ──────────────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* ═══════════════════════════════════════ EN VIVO ══ */}
              <Section
                title="En Vivo"
                count={liveMatches.length}
                dotColor={liveMatches.length > 0 ? '#EF4444' : '#D1D5DB'}
                countBg={liveMatches.length > 0 ? '#FEE2E2' : '#F3F4F6'}
                countColor={liveMatches.length > 0 ? '#DC2626' : '#9CA3AF'}
              >
                {liveMatches.length === 0 ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>
                    No hay partidos en vivo en este momento
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {liveMatches.map((m: any) => {
                      const ls   = scores[m.id];
                      const rawSets = ls?.sets || m.setsHistory;
                        const sets: any[] = Array.isArray(rawSets)
                          ? rawSets
                          : typeof rawSets === 'string'
                            ? (() => { try { return JSON.parse(rawSets); } catch { return []; } })()
                            : [];
                      return (
                        <PublicLiveCard
                          key={m.id} m={m} ls={ls} sets={sets}
                          onPlayerClick={openPlayer}
                        />
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* ═══════════════════════════════════════ PENDIENTES ══ */}
              <Section
                title="⏳ Pendientes"
                count={pendingMatches.length}
                countBg="#FEF9C3" countColor="#92400E"
              >
                {pendingMatches.length === 0 ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '16px 0', fontSize: '13px' }}>Sin partidos pendientes</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {pendingMatches.map((m: any) => (
                      <PendingRow key={m.id} m={m} onPlayerClick={openPlayer} />
                    ))}
                  </div>
                )}
              </Section>

              {/* ═══════════════════════════════════════ TERMINADOS ══ */}
              <Section
                title="✅ Terminados"
                count={doneMatches.length}
                countBg="#DCFCE7" countColor="#15803D"
              >
                {doneMatches.length === 0 ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '16px 0', fontSize: '13px' }}>Sin partidos terminados</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {doneMatches.map((m: any) => (
                      <DoneRow key={m.id} m={m} onPlayerClick={openPlayer} />
                    ))}
                  </div>
                )}
              </Section>

            </div>{/* /columna principal */}

            {/* ── Panel lateral jugador ──────────────────────────────────── */}
            {playerPanel && (
              <PublicPlayerPanel
                player={playerPanel}
                tab={playerTab} setTab={setPlayerTab}
                stats={playerStats}
                history={playerHistory}
                tournamentMatches={playerMatches}
                onClose={() => setPlayerPanel(null)}
              />
            )}

          </div>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0 8px', color: '#9CA3AF', fontSize: '12px' }}>
          LAT — Liga de Tenis · Marcadores en tiempo real
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Contenedor de sección reutilizable
// ═════════════════════════════════════════════════════════════════════════════
function Section({ title, count, dotColor, countBg, countColor, children }: any) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {dotColor && (
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block', flexShrink: 0 }} />
        )}
        <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1B3A1B', margin: 0 }}>{title}</h2>
        <span style={{ backgroundColor: countBg, color: countColor, fontSize: '11px', fontWeight: '700', padding: '1px 9px', borderRadius: '999px' }}>
          {count}
        </span>
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TARJETA PARTIDO EN VIVO — pública
// ═════════════════════════════════════════════════════════════════════════════
function PublicLiveCard({ m, ls, sets, onPlayerClick }: any) {
  const p1Sets   = ls?.sets1  ?? m.sets1  ?? 0;
  const p2Sets   = ls?.sets2  ?? m.sets2  ?? 0;
  const p1Games  = ls?.games1 ?? m.games1 ?? 0;
  const p2Games  = ls?.games2 ?? m.games2 ?? 0;
  const p1Points = ls?.points1 ?? m.points1;
  const p2Points = ls?.points2 ?? m.points2;
  const p1Win = p1Sets > p2Sets || (p1Sets === p2Sets && p1Games > p2Games);
  const p2Win = p2Sets > p1Sets || (p1Sets === p2Sets && p2Games > p1Games);
  // Parsear setsHistory defensivamente — puede llegar como string JSON
  const parseSets = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
    return [];
  };
  const setsHistory: any[] = parseSets(sets || m.setsHistory);

  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(239,68,68,0.10)', border: '1.5px solid #FECACA' }}>

      {/* Cabecera */}
      <div style={{ background: 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
          <span style={{ color: '#EF4444', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>En Vivo</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: '#86EFAC', fontWeight: '700', fontSize: '12px' }}>{ROUND_LABELS[m.round] || m.round}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>{m.category}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {m.courtName && <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>🎾 {m.courtName}</span>}
          {/* Botón marcador detallado */}
          <a
            href={`/live/${m.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', padding: '4px 11px', borderRadius: '7px', fontSize: '11px', fontWeight: '600', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}
          >
            Ver marcador ↗
          </a>
        </div>
      </div>

      {/* Scoreboard */}
      <div style={{ backgroundColor: '#FAFAFA' }}>
        <PubScoreRow
          name={m.player1Name} photoUrl={m.player1PhotoUrl}
          sets={p1Sets} games={p1Games} points={p1Points}
          isWinning={p1Win}
          setsHistory={setsHistory.map((s: any) => ({ mine: s.games1, theirs: s.games2 }))}
          onPlayerClick={() => onPlayerClick(m.player1Id, m.player1Name, m.player1PhotoUrl)}
        />
        <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0 16px' }} />
        <PubScoreRow
          name={m.player2Name} photoUrl={m.player2PhotoUrl}
          sets={p2Sets} games={p2Games} points={p2Points}
          isWinning={p2Win}
          setsHistory={setsHistory.map((s: any) => ({ mine: s.games2, theirs: s.games1 }))}
          onPlayerClick={() => onPlayerClick(m.player2Id, m.player2Name, m.player2PhotoUrl)}
        />
      </div>

      {/* Historial de sets */}
      {setsHistory.length > 0 && (
        <div style={{ backgroundColor: 'white', borderTop: '1px solid #F3F4F6', padding: '10px 18px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Historial de sets
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {setsHistory.map((s: any, idx: number) => {
              const p1w = s.games1 > s.games2;
              return (
                <div key={idx} style={{ backgroundColor: '#F9FAFB', borderRadius: '10px', padding: '7px 14px', minWidth: '54px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#9CA3AF', fontWeight: '600' }}>Set {idx + 1}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: p1w ? '#15803D' : '#374151', lineHeight: 1 }}>{s.games1}</span>
                    <span style={{ fontSize: '11px', color: '#D1D5DB' }}>–</span>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: !p1w ? '#15803D' : '#374151', lineHeight: 1 }}>{s.games2}</span>
                  </div>
                  {(s.tiebreak1 !== undefined || s.tiebreak2 !== undefined) && (
                    <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#9CA3AF' }}>TB {s.tiebreak1 ?? 0}–{s.tiebreak2 ?? 0}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fila de jugador en partido en vivo ────────────────────────────────────────
function PubScoreRow({ name, photoUrl, sets, games, points, isWinning, setsHistory, onPlayerClick }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', backgroundColor: isWinning ? '#F0FDF4' : 'transparent' }}>
      <button onClick={onPlayerClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
        <PlayerAvatar name={name || '?'} photoUrl={photoUrl} size={52} borderColor={isWinning ? '#22C55E' : '#E5E7EB'} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onPlayerClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: isWinning ? '800' : '600', color: isWinning ? '#1B3A1B' : '#374151', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name || 'BYE'}
          </span>
          {isWinning && (
            <span style={{ fontSize: '10px', backgroundColor: '#DCFCE7', color: '#15803D', padding: '1px 7px', borderRadius: '999px', fontWeight: '800', flexShrink: 0 }}>GANA</span>
          )}
          <ChevronRight size={12} color="#9CA3AF" style={{ flexShrink: 0 }} />
        </button>
        {setsHistory.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', marginTop: '3px' }}>
            {setsHistory.map((s: any, i: number) => (
              <span key={i} style={{ fontSize: '12px', fontWeight: s.mine > s.theirs ? '800' : '400', color: s.mine > s.theirs ? '#15803D' : '#9CA3AF' }}>
                {s.mine}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Sets */}
      <div style={{ textAlign: 'center', minWidth: '30px' }}>
        <p style={{ margin: 0, fontSize: '10px', color: '#9CA3AF', fontWeight: '600' }}>Sets</p>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: isWinning ? '#15803D' : '#374151', lineHeight: 1.1 }}>{sets}</p>
      </div>
      {/* Games */}
      <div style={{ textAlign: 'center', minWidth: '52px', backgroundColor: isWinning ? '#DCFCE7' : '#F3F4F6', borderRadius: '12px', padding: '8px 10px' }}>
        <p style={{ margin: 0, fontSize: '10px', color: isWinning ? '#15803D' : '#9CA3AF', fontWeight: '600' }}>Games</p>
        <p style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: isWinning ? '#15803D' : '#1B3A1B', lineHeight: 1 }}>{games}</p>
      </div>
      {/* Puntos */}
      {(points !== undefined && points !== null) && (
        <div style={{ textAlign: 'center', minWidth: '38px', backgroundColor: '#EDE9FE', borderRadius: '10px', padding: '7px 8px' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#6D28D9', fontWeight: '600' }}>Pts</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#6D28D9', lineHeight: 1.1 }}>{PTS_LABEL[String(points)] ?? points}</p>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FILA PARTIDO PENDIENTE
// ═════════════════════════════════════════════════════════════════════════════
function PendingRow({ m, onPlayerClick }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: 'white', flexWrap: 'wrap' }}>
      {/* Badges */}
      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
          {ROUND_LABELS[m.round] || m.round}
        </span>
        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
          {m.category}
        </span>
      </div>

      {/* Jugadores */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: '180px' }}>
        <ClickablePlayer name={m.player1Name} photoUrl={m.player1PhotoUrl} playerId={m.player1Id} onPlayerClick={onPlayerClick} />
        <span style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '700' }}>vs</span>
        <ClickablePlayer name={m.player2Name} photoUrl={m.player2PhotoUrl} playerId={m.player2Id} onPlayerClick={onPlayerClick} />
      </div>

      {/* Fecha y hora */}
      {m.scheduledAt && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>
            📅 {new Date(m.scheduledAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span style={{ fontSize: '11px', color: '#6B7280' }}>
            🕐 {new Date(m.scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      {m.courtName && (
        <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>🎾 {m.courtName}</span>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FILA PARTIDO TERMINADO
// ═════════════════════════════════════════════════════════════════════════════
function DoneRow({ m, onPlayerClick }: any) {
  const p1Won = m.winnerId === m.player1Id;
  const sets  = `${m.sets1 ?? 0}–${m.sets2 ?? 0}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: 'white', flexWrap: 'wrap' }}>
      {/* Badges */}
      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
          {ROUND_LABELS[m.round] || m.round}
        </span>
        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
          {m.category}
        </span>
      </div>

      {/* Jugadores + resultado */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: '200px' }}>
        <ClickablePlayer name={m.player1Name} photoUrl={m.player1PhotoUrl} playerId={m.player1Id} onPlayerClick={onPlayerClick} winner={p1Won} dim={!p1Won} />
        <span style={{ fontSize: '15px', fontWeight: '900', fontFamily: 'monospace', color: '#1B3A1B', padding: '0 4px' }}>
          {m.status === 'wo' ? <span style={{ fontSize: '11px', color: '#92400E' }}>W.O.</span> : sets}
        </span>
        <ClickablePlayer name={m.player2Name} photoUrl={m.player2PhotoUrl} playerId={m.player2Id} onPlayerClick={onPlayerClick} winner={!p1Won} dim={p1Won} />
      </div>

      {/* Fecha */}
      {m.scheduledAt && (
        <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500', flexShrink: 0 }}>
          📅 {new Date(m.scheduledAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      )}

      {/* Ganador */}
      <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803D', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <Trophy size={12} color="#2D6A2D" /> {m.winnerName || '—'}
      </span>
    </div>
  );
}

// ── Jugador clickeable (reutilizable) ─────────────────────────────────────────
function ClickablePlayer({ name, photoUrl, playerId, onPlayerClick, winner = false, dim = false }: any) {
  if (!playerId) return <span style={{ color: '#9CA3AF', fontSize: '13px' }}>BYE</span>;
  return (
    <button
      onClick={() => onPlayerClick(playerId, name, photoUrl)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '6px', opacity: dim ? 0.45 : 1 }}
    >
      <PlayerAvatar name={name || '?'} photoUrl={photoUrl} size={28} borderColor={winner ? '#22C55E' : undefined} />
      <span style={{ fontSize: '13px', fontWeight: winner ? '700' : '500', color: winner ? '#1B3A1B' : '#374151' }}>
        {name || 'BYE'}
      </span>
      {winner && <Trophy size={11} color="#2D6A2D" />}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PANEL PERFIL JUGADOR — versión pública
// ═════════════════════════════════════════════════════════════════════════════
function PublicPlayerPanel({ player, tab, setTab, stats, history, tournamentMatches, onClose }: any) {
  const winRate     = stats ? Math.round((stats.winRate ?? 0) * 100) : 0;
  const totalPoints = history?.totalPoints ?? 0;

  return (
    <div style={{
      width: '320px', flexShrink: 0,
      backgroundColor: 'white', borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      position: 'sticky', top: '20px',
      maxHeight: 'calc(100vh - 100px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)', padding: '20px', position: 'relative', flexShrink: 0 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} color="white" />
        </button>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={64} borderColor="rgba(255,255,255,0.5)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 8px', fontWeight: '800', color: 'white', fontSize: '15px', lineHeight: 1.2, paddingRight: '32px' }}>{player.name}</p>
            {stats && (
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { v: stats.wins ?? 0,   l: 'Victorias', c: '#86EFAC' },
                  { v: stats.losses ?? 0, l: 'Derrotas',  c: '#FCA5A5' },
                  { v: `${winRate}%`,     l: 'Win Rate',  c: '#FDE68A' },
                ].map(({ v, l, c }) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '19px', fontWeight: '900', color: c, lineHeight: 1 }}>{v}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.55)' }}>{l}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {totalPoints > 0 && (
          <div style={{ marginTop: '12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '9px', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={13} color="#FDE68A" />
            <span style={{ color: '#FDE68A', fontWeight: '800', fontSize: '13px' }}>{totalPoints} pts</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>escalafón · {history?.tournamentsPlayed ?? 0} torneos</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        {[
          { id: 'torneo',    label: '🏟 Torneo'   },
          { id: 'historial', label: '📜 Historial' },
          { id: 'stats',     label: '📊 Stats'     },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', backgroundColor: tab === t.id ? 'white' : '#F9FAFB', color: tab === t.id ? '#1B3A1B' : '#9CA3AF', borderBottom: tab === t.id ? '2px solid #2D6A2D' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

        {/* Tab Torneo */}
        {tab === 'torneo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tournamentMatches.length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>Sin partidos en este torneo</p>
            ) : tournamentMatches.map((m: any) => {
              const isP1    = m.player1Id === player.id;
              const oppName = isP1 ? m.player2Name : m.player1Name;
              const oppPhoto= isP1 ? m.player2PhotoUrl : m.player1PhotoUrl;
              const myWon   = m.winnerId === player.id;
              const isLive  = m.status === 'live';
              const isDone  = m.status === 'completed' || m.status === 'wo';
              const mySets  = ((isP1 ? m.sets1 : m.sets2) ?? 0);
              const oppSets = ((isP1 ? m.sets2 : m.sets1) ?? 0);

              return (
                <div key={m.id} style={{ padding: '10px 12px', borderRadius: '10px', border: `1.5px solid ${isLive ? '#FECACA' : isDone && myWon ? '#86EFAC' : isDone ? '#FECACA' : '#E5E7EB'}`, backgroundColor: isLive ? '#FFF8F8' : isDone && myWon ? '#F0FDF4' : isDone ? '#FFF5F5' : 'white' }}>
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '7px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '600', backgroundColor: '#F3E8FF', color: '#6B21A8' }}>{ROUND_LABELS[m.round] || m.round}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '600', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{m.category}</span>
                    {isLive && <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', backgroundColor: '#FEE2E2', color: '#DC2626' }}>🔴 Vivo</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <PlayerAvatar name={oppName || '?'} photoUrl={oppPhoto} size={28} />
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#374151' }}>vs {oppName || 'BYE'}</p>
                        {isDone && <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: myWon ? '#15803D' : '#DC2626' }}>{myWon ? '✓ Victoria' : '✗ Derrota'}{m.status === 'wo' ? ' (W.O.)' : ''}</p>}
                        {!isDone && !isLive && <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Por programar'}</p>}
                      </div>
                    </div>
                    {isDone && <span style={{ fontSize: '15px', fontWeight: '900', fontFamily: 'monospace', color: myWon ? '#15803D' : '#DC2626' }}>{mySets}–{oppSets}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Historial */}
        {tab === 'historial' && (
          <div>
            {!history ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>Cargando...</p>
            ) : (history?.history || []).length === 0 ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>Sin historial aún</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'Puntos', value: totalPoints,                    color: '#15803D', bg: '#F0FDF4' },
                    { label: 'Torneos', value: history.tournamentsPlayed ?? 0, color: '#1D4ED8', bg: '#EFF6FF' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ backgroundColor: bg, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color }}>{value}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#6B7280', fontWeight: '600' }}>{label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(history.history as any[]).map((h: any) => (
                    <div key={h.id} style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: '#1B3A1B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.tournamentName}</p>
                          <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#6B7280' }}>{h.category} · {h.roundReached}</p>
                          <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={9} />{new Date(h.createdAt).toLocaleDateString('es-CO')}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '8px' }}>
                          <p style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#15803D' }}>{Number(h.totalPoints).toFixed(0)}</p>
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

        {/* Tab Stats */}
        {tab === 'stats' && (
          <div>
            {!stats ? (
              <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>Cargando...</p>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803D' }}>Victorias {winRate}%</span>
                    <span style={{ fontSize: '12px', color: '#DC2626' }}>Derrotas {100 - winRate}%</span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '999px', backgroundColor: '#FEE2E2', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${winRate}%`, background: 'linear-gradient(90deg, #2D6A2D, #4ADE80)', borderRadius: '999px' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Partidos', value: stats.totalMatches ?? 0, color: '#1D4ED8', bg: '#EFF6FF' },
                    { label: 'Victorias', value: stats.wins ?? 0,         color: '#15803D', bg: '#F0FDF4' },
                    { label: 'Derrotas',  value: stats.losses ?? 0,       color: '#DC2626', bg: '#FEF2F2' },
                    { label: 'Win Rate',  value: `${winRate}%`,           color: '#92400E', bg: '#FEF3C7' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ backgroundColor: bg, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: '900', color, lineHeight: 1 }}>{value}</p>
                      <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#6B7280', fontWeight: '600' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BADGE de estado del torneo — colores semánticos
// ═════════════════════════════════════════════════════════════════════════════
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    open:      { label: 'Inscripciones abiertas', bg: '#DCFCE7', color: '#15803D', dot: '#22C55E' },
    closed:    { label: 'Inscripciones cerradas', bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
    active:    { label: 'En curso',               bg: '#DBEAFE', color: '#1D4ED8', dot: '#3B82F6' },
    completed: { label: 'Finalizado',             bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
  };
  const cfg = map[status] || { label: status, bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', backgroundColor: cfg.bg, color: cfg.color }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BANNER de inscripciones — informa al jugador qué puede hacer
// ═════════════════════════════════════════════════════════════════════════════
function EnrollmentBanner({ tournament }: { tournament: any }) {
  if (!tournament) return null;

  const { status, hasDoubles, doublesOpenForRegistration } = tournament;

  // ── Torneo abierto para singles ──────────────────────────────────────
  if (status === 'open') {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap',
        backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC',
        borderRadius: '14px', padding: '16px 20px', marginBottom: '16px',
      }}>
        <span style={{ fontSize: '22px', flexShrink: 0 }}>✅</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontWeight: '800', color: '#15803D', fontSize: '14px' }}>
            ¡Inscripciones abiertas!
          </p>
          <p style={{ margin: 0, color: '#166534', fontSize: '13px', lineHeight: '1.5' }}>
            Puedes inscribirte en este torneo. Contacta al administrador de la LAT para completar tu inscripción.
            {hasDoubles && doublesOpenForRegistration && (
              <> También están abiertas las <strong>inscripciones de dobles</strong>.</>
            )}
          </p>
        </div>
        <a href="/login" style={{ flexShrink: 0, backgroundColor: '#15803D', color: 'white', padding: '9px 18px', borderRadius: '9px', fontWeight: '700', fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(21,128,61,0.3)' }}>
          Inscribirme →
        </a>
      </div>
    );
  }

  // ── Solo dobles abiertos (torneo closed/active pero doublesOpen) ─────
  if (status !== 'open' && hasDoubles && doublesOpenForRegistration) {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap',
        backgroundColor: '#EFF6FF', border: '1.5px solid #93C5FD',
        borderRadius: '14px', padding: '16px 20px', marginBottom: '16px',
      }}>
        <span style={{ fontSize: '22px', flexShrink: 0 }}>🤝</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontWeight: '800', color: '#1D4ED8', fontSize: '14px' }}>
            Inscripciones de dobles abiertas
          </p>
          <p style={{ margin: 0, color: '#1E40AF', fontSize: '13px', lineHeight: '1.5' }}>
            Las inscripciones de singles están cerradas, pero aún puedes inscribirte en la modalidad de <strong>dobles</strong>. Ingresa para registrar tu pareja antes de que el torneo sea programado.
          </p>
        </div>
        <a href="/login" style={{ flexShrink: 0, backgroundColor: '#1D4ED8', color: 'white', padding: '9px 18px', borderRadius: '9px', fontWeight: '700', fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(29,78,216,0.25)' }}>
          Inscribir pareja →
        </a>
      </div>
    );
  }

  // ── Inscripciones cerradas ───────────────────────────────────────────
  if (status === 'closed') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A',
        borderRadius: '14px', padding: '14px 20px', marginBottom: '16px',
      }}>
        <span style={{ fontSize: '20px' }}>🔒</span>
        <p style={{ margin: 0, color: '#92400E', fontSize: '13px', fontWeight: '600' }}>
          Las inscripciones están cerradas para este torneo.
        </p>
      </div>
    );
  }

  // ── Torneo en curso ──────────────────────────────────────────────────
  if (status === 'active') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        backgroundColor: '#EFF6FF', border: '1.5px solid #BFDBFE',
        borderRadius: '14px', padding: '14px 20px', marginBottom: '16px',
      }}>
        <span style={{ fontSize: '20px' }}>🎾</span>
        <p style={{ margin: 0, color: '#1D4ED8', fontSize: '13px', fontWeight: '600' }}>
          Torneo en curso · Sigue los partidos en tiempo real.
        </p>
      </div>
    );
  }

  // ── Torneo completado ────────────────────────────────────────────────
  if (status === 'completed') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        backgroundColor: '#F3F4F6', border: '1.5px solid #D1D5DB',
        borderRadius: '14px', padding: '14px 20px', marginBottom: '16px',
      }}>
        <span style={{ fontSize: '20px' }}>🏆</span>
        <p style={{ margin: 0, color: '#6B7280', fontSize: '13px', fontWeight: '600' }}>
          Este torneo ha finalizado. Consulta los resultados en el historial.
        </p>
      </div>
    );
  }

  return null;
}