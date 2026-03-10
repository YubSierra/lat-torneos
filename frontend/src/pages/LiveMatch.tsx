// frontend/src/pages/LiveMatch.tsx  ← REEMPLAZA COMPLETO
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../api/axios';
import PlayerAvatar from '../components/PlayerAvatar';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface SetScore {
  games1: number; games2: number;
  tiebreak1?: number; tiebreak2?: number;
}

type EventType = 'point' | 'game' | 'set' | 'match' | 'info';

interface MatchEvent {
  id: string;
  type: EventType;
  text: string;
  player?: 1 | 2;          // quién ganó
  time: string;             // HH:MM
  icon: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────
const now = () =>
  new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const PTS: Record<string, string> = {
  '0': '0', '15': '15', '30': '30', '40': '40', 'A': 'AD',
};

// ═════════════════════════════════════════════════════════════════════════════
export default function LiveMatch() {
  const { matchId } = useParams<{ matchId: string }>();

  const [match,         setMatch]         = useState<any>(null);
  const [sets,          setSets]          = useState<SetScore[]>([]);
  const [games1,        setGames1]        = useState(0);
  const [games2,        setGames2]        = useState(0);
  const [points1,       setPoints1]       = useState('0');
  const [points2,       setPoints2]       = useState('0');
  const [status,        setStatus]        = useState('pending');
  const [winnerId,      setWinnerId]      = useState<string | null>(null);
  const [connected,     setConnected]     = useState(false);
  const [events,        setEvents]        = useState<MatchEvent[]>([]);
  const [celebration,   setCelebration]   = useState(false);
  const [confetti,      setConfetti]      = useState<{ x: number; color: string; delay: number; size: number }[]>([]);

  // refs para detectar cambios
  const prevRef = useRef({ sets: [] as SetScore[], games1: 0, games2: 0, points1: '0', points2: '0' });
  const socketRef  = useRef<Socket | null>(null);
  const logRef     = useRef<HTMLDivElement>(null);

  // Agregar evento al log
  const addEvent = useCallback((ev: Omit<MatchEvent, 'id' | 'time'>) => {
    setEvents(prev => [
      { ...ev, id: `${Date.now()}-${Math.random()}`, time: now() },
      ...prev,   // más reciente arriba
    ]);
  }, []);

  // Detectar qué cambió entre la actualización anterior y la nueva
  const detectChanges = useCallback((
    data: { sets: SetScore[]; currentGames1: number; currentGames2: number; currentPoints1: string; currentPoints2: string; winnerId?: string },
    p1Name: string, p2Name: string
  ) => {
    const prev = prevRef.current;

    // ── Set terminado ─────────────────────────────────────────────────────
    if (data.sets.length > prev.sets.length) {
      const s = data.sets[data.sets.length - 1];
      const p1WonSet = s.games1 > s.games2;
      const setNum = data.sets.length;
      addEvent({
        type: 'set',
        player: p1WonSet ? 1 : 2,
        icon: '🎾',
        text: `Set ${setNum} para ${p1WonSet ? p1Name : p2Name}  ${s.games1}–${s.games2}${s.tiebreak1 !== undefined ? ` (TB ${s.tiebreak1}–${s.tiebreak2})` : ''}`,
      });
    }

    // ── Game terminado (dentro del set) ──────────────────────────────────
    if (
      data.sets.length === prev.sets.length &&   // no fue set
      (data.currentGames1 !== prev.games1 || data.currentGames2 !== prev.games2)
    ) {
      const p1WonGame = data.currentGames1 > prev.games1;
      addEvent({
        type: 'game',
        player: p1WonGame ? 1 : 2,
        icon: '✦',
        text: `Game para ${p1WonGame ? p1Name : p2Name}  (${data.currentGames1}–${data.currentGames2})`,
      });
    }

    // ── Punto ────────────────────────────────────────────────────────────
    const pt1 = data.currentPoints1; const pt2 = data.currentPoints2;
    const pp1 = prev.points1;        const pp2 = prev.points2;

    // Si el marcador de puntos cambió (sin que haya terminado el game)
    if (
      data.sets.length === prev.sets.length &&
      data.currentGames1 === prev.games1 && data.currentGames2 === prev.games2 &&
      (pt1 !== pp1 || pt2 !== pp2)
    ) {
      const VALS: Record<string, number> = { '0': 0, '15': 15, '30': 30, '40': 40, 'A': 50 };
      const p1Scored = (VALS[pt1] ?? 0) > (VALS[pp1] ?? 0) || (pt1 === '0' && pp1 === '40');
      addEvent({
        type: 'point',
        player: p1Scored ? 1 : 2,
        icon: '·',
        text: `${p1Scored ? p1Name : p2Name}  ${PTS[pt1] ?? pt1}–${PTS[pt2] ?? pt2}`,
      });
    }

    // ── Partido terminado ─────────────────────────────────────────────────
    if (data.winnerId && !prevRef.current.sets.find(() => true)?.games1 === false) {
      // Lo manejamos en matchFinished
    }
  }, [addEvent]);

  // ── Efecto principal: carga y socket ─────────────────────────────────────
  useEffect(() => {
    // Helper para parsear setsHistory — puede llegar como string JSON o array
    const parseSets = (raw: any): SetScore[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
      return [];
    };

    api.get(`/matches/${matchId}/live`).then(res => {
      const m = res.data;
      const parsedSets = parseSets(m.setsHistory);
      setMatch(m);
      setStatus(m.status);
      setWinnerId(m.winnerId);
      setSets(parsedSets);
      setGames1(m.games1 || 0);
      setGames2(m.games2 || 0);
      setPoints1(m.points1 || '0');
      setPoints2(m.points2 || '0');
      prevRef.current = {
        sets: parsedSets,
        games1: m.games1 || 0,
        games2: m.games2 || 0,
        points1: m.points1 || '0',
        points2: m.points2 || '0',
      };
      addEvent({ type: 'info', icon: '🎾', text: 'Partido cargado · Esperando actualizaciones en vivo' });
      if (m.status === 'live') {
        addEvent({ type: 'info', icon: '▶', text: 'Partido en curso' });
      }
    });

    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const socket = io(`${SOCKET_URL}/matches`, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinMatch', { matchId });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('matchStarted', () => {
      setStatus('live');
      addEvent({ type: 'info', icon: '▶', text: 'El partido ha comenzado' });
    });

    socket.on('liveScoreUpdated', (data: any) => {
      setMatch((prev: any) => {
        if (!prev) return prev;
        detectChanges(data, prev.player1Name, prev.player2Name);
        return prev;
      });

      setSets(data.sets || []);
      setGames1(data.currentGames1 || 0);
      setGames2(data.currentGames2 || 0);
      setPoints1(data.currentPoints1 || '0');
      setPoints2(data.currentPoints2 || '0');
      setStatus(data.status);
      if (data.winnerId) setWinnerId(data.winnerId);

      prevRef.current = {
        sets: data.sets || [],
        games1: data.currentGames1 || 0,
        games2: data.currentGames2 || 0,
        points1: data.currentPoints1 || '0',
        points2: data.currentPoints2 || '0',
      };
    });

    socket.on('matchFinished', (data: any) => {
      setStatus('completed');
      setWinnerId(data.winnerId);
      // Celebración
      triggerCelebration();
    });

    return () => { socket.disconnect(); };
  }, [matchId]);

  // Auto-celebración si el partido ya estaba terminado al cargar
  useEffect(() => {
    if (status === 'completed' && winnerId) {
      triggerCelebration();
      setMatch((m: any) => {
        if (!m) return m;
        const wName = winnerId === m.player1Id ? m.player1Name : m.player2Name;
        addEvent({ type: 'match', player: winnerId === m.player1Id ? 1 : 2, icon: '🏆', text: `¡${wName} gana el partido!` });
        return m;
      });
    }
  }, [status, winnerId]);

  const triggerCelebration = () => {
    setCelebration(true);
    const pieces = Array.from({ length: 60 }, (_, i) => ({
      x: Math.random() * 100,
      color: ['#FDE68A', '#86EFAC', '#93C5FD', '#F9A8D4', '#FCA5A5', '#A5F3FC'][i % 6],
      delay: Math.random() * 2,
      size: 6 + Math.random() * 10,
    }));
    setConfetti(pieces);
    setTimeout(() => setCelebration(false), 6000);
  };

  // ── Scroll del log al tope cuando llega nuevo evento ─────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [events.length]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!match) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0A1A0A 0%, #111 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎾</div>
          <p style={{ color: '#6B7280', fontSize: '16px' }}>Cargando partido...</p>
        </div>
      </div>
    );
  }

  const winnerName = winnerId === match.player1Id ? match.player1Name
                   : winnerId === match.player2Id ? match.player2Name : null;

  const sets1 = sets.filter(s => s.games1 > s.games2).length;
  const sets2 = sets.filter(s => s.games2 > s.games1).length;
  const p1Ahead = sets1 > sets2 || (sets1 === sets2 && games1 > games2);
  const p2Ahead = sets2 > sets1 || (sets1 === sets2 && games2 > games1);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0A1A0A 0%, #0F0F0F 100%)', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* ── Confetti celebración ─────────────────────────────────────────── */}
      {celebration && confetti.map((c, i) => (
        <div key={i} style={{
          position: 'fixed', top: '-20px', left: `${c.x}%`,
          width: `${c.size}px`, height: `${c.size}px`,
          backgroundColor: c.color, borderRadius: '2px',
          animation: `confettiFall ${2 + c.delay}s ease-in forwards`,
          animationDelay: `${c.delay * 0.3}s`,
          zIndex: 9999, pointerEvents: 'none',
          transform: `rotate(${Math.random() * 360}deg)`,
        }} />
      ))}

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          {/* Logo */}
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              🎾 LAT Torneos
            </span>
          </div>

          {/* Status pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '999px', padding: '6px 18px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
              backgroundColor: status === 'live' ? '#EF4444' : status === 'completed' ? '#86EFAC' : '#6B7280',
              boxShadow: status === 'live' ? '0 0 8px #EF4444' : 'none',
              animation: status === 'live' ? 'pulse 1.2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color: status === 'live' ? '#EF4444' : status === 'completed' ? '#86EFAC' : '#9CA3AF', fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em' }}>
              {status === 'live' ? 'EN VIVO' : status === 'completed' ? 'FINALIZADO' : 'PRÓXIMO'}
            </span>
            <span style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <span style={{ color: connected ? '#86EFAC' : '#6B7280', fontSize: '11px', fontWeight: '500' }}>
              {connected ? '⬤ Conectado' : '○ Reconectando...'}
            </span>
          </div>

          {/* Info torneo */}
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '10px 0 0', letterSpacing: '0.05em' }}>
            {match.category} · {match.round}
            {match.courtName && ` · ${match.courtName}`}
          </p>
        </div>

        {/* ── SCOREBOARD ──────────────────────────────────────────────── */}
        <div style={{ backgroundColor: '#161616', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', marginBottom: '16px' }}>

          {/* Header de columnas */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ flex: 1 }} />
            {/* Cabeceras de sets completados */}
            {sets.map((_, i) => (
              <div key={i} style={{ minWidth: '40px', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: '700', letterSpacing: '0.08em' }}>
                S{i + 1}
              </div>
            ))}
            {/* Columna game actual */}
            {status === 'live' && (
              <div style={{ minWidth: '52px', textAlign: 'center', fontSize: '10px', color: '#86EFAC', fontWeight: '700', letterSpacing: '0.08em' }}>
                GAME
              </div>
            )}
            {/* Columna puntos */}
            {status === 'live' && (
              <div style={{ minWidth: '48px', textAlign: 'center', fontSize: '10px', color: '#FCD34D', fontWeight: '700', letterSpacing: '0.08em' }}>
                PTS
              </div>
            )}
            {/* Sets ganados */}
            <div style={{ minWidth: '44px', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: '700', letterSpacing: '0.08em' }}>
              SETS
            </div>
          </div>

          {/* Filas jugadores */}
          {[
            { name: match.player1Name, photoUrl: match.player1PhotoUrl, id: match.player1Id, seeding: match.seeding1, isP1: true,  setsWon: sets1, ahead: p1Ahead, games: games1, points: points1 },
            { name: match.player2Name, photoUrl: match.player2PhotoUrl, id: match.player2Id, seeding: match.seeding2, isP1: false, setsWon: sets2, ahead: p2Ahead, games: games2, points: points2 },
          ].map((p, idx) => {
            const isWinner = winnerId === p.id;
            const isLeading = status === 'live' && p.ahead;
            const rowBg = isWinner
              ? 'linear-gradient(90deg, rgba(134,239,172,0.12) 0%, rgba(134,239,172,0.04) 100%)'
              : isLeading
                ? 'rgba(255,255,255,0.04)'
                : 'transparent';

            return (
              <div key={p.id} style={{
                background: rowBg,
                borderBottom: idx === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                padding: '18px 20px',
                display: 'flex', alignItems: 'center',
                transition: 'background 0.4s ease',
              }}>
                {/* Avatar + nombre */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <PlayerAvatar
                      name={p.name || '?'}
                      photoUrl={p.photoUrl}
                      size={46}
                      borderColor={isWinner ? '#86EFAC' : isLeading ? '#FCD34D' : 'rgba(255,255,255,0.15)'}
                    />
                    {isLeading && !isWinner && (
                      <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FCD34D', border: '2px solid #161616', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px' }}>
                        ▲
                      </span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {p.seeding && (
                      <span style={{ fontSize: '9px', fontWeight: '800', backgroundColor: '#92400E', color: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', marginBottom: '3px', display: 'inline-block', letterSpacing: '0.05em' }}>
                        [{p.seeding}]
                      </span>
                    )}
                    <p style={{
                      margin: 0,
                      color: isWinner ? '#86EFAC' : isLeading ? '#FDE68A' : 'rgba(255,255,255,0.9)',
                      fontSize: '18px', fontWeight: isWinner || isLeading ? '800' : '600',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      letterSpacing: '-0.02em',
                    }}>
                      {p.name || 'Jugador'}
                      {isWinner && <span style={{ marginLeft: '8px', fontSize: '16px' }}>✓</span>}
                    </p>
                  </div>
                </div>

                {/* Sets completados */}
                {sets.map((s, i) => {
                  const won = p.isP1 ? s.games1 > s.games2 : s.games2 > s.games1;
                  return (
                    <div key={i} style={{ minWidth: '40px', textAlign: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: '700', color: won ? '#86EFAC' : 'rgba(255,255,255,0.3)' }}>
                        {p.isP1 ? s.games1 : s.games2}
                      </span>
                      {(s.tiebreak1 !== undefined || s.tiebreak2 !== undefined) && (
                        <sup style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginLeft: '2px' }}>
                          {p.isP1 ? s.tiebreak1 : s.tiebreak2}
                        </sup>
                      )}
                    </div>
                  );
                })}

                {/* Game actual */}
                {status === 'live' && (
                  <div style={{ minWidth: '52px', textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '40px', height: '40px', borderRadius: '10px',
                      backgroundColor: isLeading ? '#2D6A2D' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isLeading ? '#4ADE80' : 'rgba(255,255,255,0.1)'}`,
                      transition: 'all 0.3s ease',
                    }}>
                      <span style={{ fontSize: '22px', fontWeight: '900', color: isLeading ? '#86EFAC' : 'rgba(255,255,255,0.8)' }}>
                        {p.games}
                      </span>
                    </div>
                  </div>
                )}

                {/* Puntos */}
                {status === 'live' && (
                  <div style={{ minWidth: '48px', textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '36px', height: '32px', borderRadius: '7px',
                      backgroundColor: 'rgba(252,211,77,0.12)',
                      border: '1px solid rgba(252,211,77,0.2)',
                    }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#FCD34D', letterSpacing: '0.02em' }}>
                        {PTS[p.points] ?? p.points}
                      </span>
                    </div>
                  </div>
                )}

                {/* Sets ganados */}
                <div style={{ minWidth: '44px', textAlign: 'center' }}>
                  <span style={{
                    fontSize: '26px', fontWeight: '900',
                    color: isWinner ? '#86EFAC' : isLeading ? '#FDE68A' : 'rgba(255,255,255,0.6)',
                    lineHeight: 1,
                  }}>
                    {p.setsWon}
                  </span>
                </div>

              </div>
            );
          })}

          {/* Formato del partido */}
          {match.gameFormat && (
            <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', margin: 0, letterSpacing: '0.05em' }}>
                {match.gameFormat.sets} sets · {match.gameFormat.gamesPerSet} games
                · {match.gameFormat.withAd ? 'Con Ad' : 'Sin Ad'}
                · TB a {match.gameFormat.tiebreakPoints} pts
              </p>
            </div>
          )}
        </div>

        {/* ── CELEBRACIÓN GANADOR ──────────────────────────────────────── */}
        {status === 'completed' && winnerName && (
          <div style={{
            background: 'linear-gradient(135deg, #1B3A1B 0%, #2D6A2D 100%)',
            borderRadius: '20px', padding: '28px', textAlign: 'center',
            border: '1px solid #4ADE80',
            boxShadow: '0 0 40px rgba(74,222,128,0.2)',
            marginBottom: '16px',
            animation: 'fadeInScale 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏆</div>
            <p style={{ color: '#86EFAC', fontSize: '13px', fontWeight: '700', margin: '0 0 6px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              ¡Ganador del partido!
            </p>
            <p style={{ color: 'white', fontSize: '28px', fontWeight: '900', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              {winnerName}
            </p>
            {/* Resultado final */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {sets.map((s, i) => {
                const p1w = s.games1 > s.games2;
                const winnerWon = (winnerId === match.player1Id) ? p1w : !p1w;
                return (
                  <div key={i} style={{
                    backgroundColor: winnerWon ? 'rgba(134,239,172,0.2)' : 'rgba(255,255,255,0.06)',
                    borderRadius: '10px', padding: '8px 16px', textAlign: 'center',
                    border: `1px solid ${winnerWon ? 'rgba(134,239,172,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Set {i + 1}</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: winnerWon ? '#86EFAC' : 'rgba(255,255,255,0.5)' }}>
                      {s.games1}–{s.games2}
                      {s.tiebreak1 !== undefined && (
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}> ({s.tiebreak1}–{s.tiebreak2})</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HISTORIAL DEL PARTIDO ────────────────────────────────────── */}
        <div style={{ backgroundColor: '#161616', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📋</span>
            <h3 style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '700', letterSpacing: '0.05em' }}>
              HISTORIAL DEL PARTIDO
            </h3>
            <span style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', marginLeft: 'auto' }}>
              {events.length} eventos
            </span>
          </div>

          <div ref={logRef} style={{ maxHeight: '340px', overflowY: 'auto', padding: '8px 0' }}>
            {events.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '24px', fontSize: '13px' }}>
                Los eventos aparecerán aquí en tiempo real
              </p>
            ) : (
              events.map((ev) => (
                <EventRow key={ev.id} event={ev} p1Name={match.player1Name} p2Name={match.player2Name} />
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── CSS Animaciones ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes fadeInScale {
          0%   { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInDown {
          0%   { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        /* Scrollbar oscuro */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FILA DE EVENTO en el historial
// ═════════════════════════════════════════════════════════════════════════════
function EventRow({ event, p1Name, p2Name }: { event: MatchEvent; p1Name: string; p2Name: string }) {
  const isSet   = event.type === 'set';
  const isGame  = event.type === 'game';
  const isMatch = event.type === 'match';
  const isInfo  = event.type === 'info';

  const accent =
    isMatch ? { bg: 'rgba(134,239,172,0.10)', border: 'rgba(134,239,172,0.25)', icon: '#86EFAC', text: '#86EFAC' } :
    isSet   ? { bg: 'rgba(252,211,77,0.08)',  border: 'rgba(252,211,77,0.2)',   icon: '#FCD34D', text: '#FDE68A' } :
    isGame  ? { bg: 'rgba(147,197,253,0.06)', border: 'rgba(147,197,253,0.15)', icon: '#93C5FD', text: 'rgba(255,255,255,0.75)' } :
    isInfo  ? { bg: 'transparent', border: 'transparent', icon: 'rgba(255,255,255,0.2)', text: 'rgba(255,255,255,0.3)' } :
    { bg: 'transparent', border: 'transparent', icon: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.4)' };

  // Lado: ¿es del jugador 1 o 2?
  const sideLabel = event.player === 1 ? p1Name.split(' ')[0] : event.player === 2 ? p2Name.split(' ')[0] : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 20px',
      backgroundColor: accent.bg,
      borderLeft: isSet || isMatch ? `3px solid ${accent.border}` : '3px solid transparent',
      animation: 'slideInDown 0.25s ease both',
      marginBottom: '1px',
    }}>
      {/* Hora */}
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontWeight: '600', minWidth: '32px', fontFamily: 'monospace' }}>
        {event.time}
      </span>

      {/* Icono */}
      <span style={{ fontSize: isSet || isMatch ? '14px' : '12px', color: accent.icon, flexShrink: 0 }}>
        {event.icon}
      </span>

      {/* Texto */}
      <span style={{ fontSize: isSet || isMatch ? '13px' : '12px', color: accent.text, fontWeight: isSet || isMatch ? '700' : '400', flex: 1 }}>
        {event.text}
      </span>

      {/* Badge lado */}
      {sideLabel && !isInfo && (
        <span style={{
          fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em',
          backgroundColor: event.player === 1 ? 'rgba(147,197,253,0.15)' : 'rgba(249,168,212,0.15)',
          color: event.player === 1 ? '#93C5FD' : '#F9A8D4',
          padding: '1px 7px', borderRadius: '999px', flexShrink: 0,
        }}>
          {sideLabel}
        </span>
      )}
    </div>
  );
}