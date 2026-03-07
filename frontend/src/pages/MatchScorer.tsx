import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../api/axios';

interface SetScore { games1: number; games2: number; tiebreak1?: number; tiebreak2?: number; }
interface GameFormat {
  sets: number; gamesPerSet: number; withAd: boolean;
  tiebreakAtDeuce: boolean; tiebreakPoints: number;
  finalSetTiebreak: boolean; finalSetPoints: number;
}

const DEFAULT_FORMAT: GameFormat = {
  sets: 3, gamesPerSet: 6, withAd: true,
  tiebreakAtDeuce: true, tiebreakPoints: 7,
  finalSetTiebreak: true, finalSetPoints: 10,
};

export default function MatchScorer() {
  const { matchId }   = useParams<{ matchId: string }>();
  const navigate      = useNavigate();
  const socketRef     = useRef<Socket | null>(null);

  const [match, setMatch]                   = useState<any>(null);
  const [format, setFormat]                 = useState<GameFormat>(DEFAULT_FORMAT);
  const [completedSets, setCompletedSets]   = useState<SetScore[]>([]);
  const [games1, setGames1]                 = useState(0);
  const [games2, setGames2]                 = useState(0);
  const [points1, setPoints1]               = useState('0');
  const [points2, setPoints2]               = useState('0');
  const [inTiebreak, setInTiebreak]         = useState(false);
  const [tbPoints1, setTbPoints1]           = useState(0);
  const [tbPoints2, setTbPoints2]           = useState(0);
  const [inFinalTiebreak, setInFinalTiebreak] = useState(false);
  const [status, setStatus]                 = useState('pending');
  const [winnerId, setWinnerId]             = useState<string | null>(null);
  const [showManualResult, setShowManualResult] = useState(false);
  const [manualSets, setManualSets] = useState<{g1: number; g2: number; tb1?: number; tb2?: number}[]>([
    { g1: 0, g2: 0 }, { g1: 0, g2: 0 },
  ]);
  const [manualWinner, setManualWinner] = useState('');

  const POINTS_ORDER = ['0', '15', '30', '40', 'AD'];

  useEffect(() => {
    api.get(`/matches/${matchId}/live`).then(res => {
      const m = res.data;
      setMatch(m);
      setStatus(m.status);
      setWinnerId(m.winnerId);
      if (m.gameFormat) setFormat(m.gameFormat);
      if (m.setsHistory?.length) setCompletedSets(m.setsHistory);
      setGames1(m.games1 || 0);
      setGames2(m.games2 || 0);
      setPoints1(m.points1 || '0');
      setPoints2(m.points2 || '0');
    });

    const socket = io('http://localhost:3000/matches', { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('joinMatch', { matchId }));
    return () => { socket.disconnect(); };
  }, [matchId]);

  const emit = (newSets: SetScore[], g1: number, g2: number, p1: string, p2: string, winner?: string) => {
    socketRef.current?.emit('updateLiveScore', {
      matchId,
      sets: newSets,
      currentSet: newSets.length + 1,
      currentGames1: g1,
      currentGames2: g2,
      currentPoints1: p1,
      currentPoints2: p2,
      winnerId: winner || null,
      status: winner ? 'completed' : 'live',
    });
  };

  const checkMatchWinner = (sets: SetScore[]): string | null => {
    const setsToWin = Math.ceil(format.sets / 2);
    let s1 = 0, s2 = 0;
    sets.forEach(s => {
      if (s.games1 > s.games2) s1++;
      else s2++;
    });
    if (s1 >= setsToWin) return match?.player1Id;
    if (s2 >= setsToWin) return match?.player2Id;
    return null;
  };

  const addGame = (player: 1 | 2) => {
    const ng1 = player === 1 ? games1 + 1 : games1;
    const ng2 = player === 2 ? games2 + 1 : games2;
    const gps = format.gamesPerSet;

    if (format.tiebreakAtDeuce && ng1 === gps && ng2 === gps) {
      setGames1(ng1); setGames2(ng2);
      setInTiebreak(true);
      setPoints1('0'); setPoints2('0');
      emit(completedSets, ng1, ng2, '0', '0');
      return;
    }

    const setWinner = ng1 >= gps && ng1 - ng2 >= 2 ? 1
                    : ng2 >= gps && ng2 - ng1 >= 2 ? 2 : null;

    if (setWinner) {
      const newSet: SetScore = { games1: ng1, games2: ng2 };
      const newSets = [...completedSets, newSet];
      const matchWinner = checkMatchWinner(newSets);

      if (matchWinner) {
        setCompletedSets(newSets);
        setGames1(0); setGames2(0);
        setPoints1('0'); setPoints2('0');
        setWinnerId(matchWinner);
        setStatus('completed');
        emit(newSets, 0, 0, '0', '0', matchWinner);
      } else {
        const setsToWin = Math.ceil(format.sets / 2);
        let s1 = 0, s2 = 0;
        newSets.forEach(s => { if (s.games1 > s.games2) s1++; else s2++; });

        if (s1 === setsToWin - 1 && s2 === setsToWin - 1 && format.finalSetTiebreak) {
          setInFinalTiebreak(true);
          setCompletedSets(newSets);
          setGames1(0); setGames2(0);
          setTbPoints1(0); setTbPoints2(0);
          emit(newSets, 0, 0, '0', '0');
        } else {
          setCompletedSets(newSets);
          setGames1(0); setGames2(0);
          setPoints1('0'); setPoints2('0');
          emit(newSets, 0, 0, '0', '0');
        }
      }
    } else {
      setGames1(ng1); setGames2(ng2);
      setPoints1('0'); setPoints2('0');
      emit(completedSets, ng1, ng2, '0', '0');
    }
  };

  const addPoint = (player: 1 | 2) => {
    const p1idx = POINTS_ORDER.indexOf(points1);
    const p2idx = POINTS_ORDER.indexOf(points2);

    if (player === 1) {
      if (points1 === '40' && points2 !== '40' && points2 !== 'AD') {
        setPoints1('0'); setPoints2('0');
        addGame(1);
      } else if (points1 === 'AD') {
        setPoints1('0'); setPoints2('0');
        addGame(1);
      } else if (points1 === '40' && points2 === 'AD') {
        setPoints2('40');
        if (!format.withAd) { addGame(1); return; }
        emit(completedSets, games1, games2, '40', '40');
      } else if (points1 === '40' && points2 === '40') {
        if (format.withAd) {
          setPoints1('AD');
          emit(completedSets, games1, games2, 'AD', '40');
        } else {
          setPoints1('0'); setPoints2('0');
          addGame(1);
        }
      } else {
        const np = POINTS_ORDER[p1idx + 1] || '40';
        setPoints1(np);
        emit(completedSets, games1, games2, np, points2);
      }
    } else {
      if (points2 === '40' && points1 !== '40' && points1 !== 'AD') {
        setPoints1('0'); setPoints2('0');
        addGame(2);
      } else if (points2 === 'AD') {
        setPoints1('0'); setPoints2('0');
        addGame(2);
      } else if (points2 === '40' && points1 === 'AD') {
        setPoints1('40');
        if (!format.withAd) { addGame(2); return; }
        emit(completedSets, games1, games2, '40', '40');
      } else if (points1 === '40' && points2 === '40') {
        if (format.withAd) {
          setPoints2('AD');
          emit(completedSets, games1, games2, '40', 'AD');
        } else {
          setPoints1('0'); setPoints2('0');
          addGame(2);
        }
      } else {
        const np = POINTS_ORDER[p2idx + 1] || '40';
        setPoints2(np);
        emit(completedSets, games1, games2, points1, np);
      }
    }
  };

  const addTiebreakPoint = (player: 1 | 2) => {
    const np1 = player === 1 ? tbPoints1 + 1 : tbPoints1;
    const np2 = player === 2 ? tbPoints2 + 1 : tbPoints2;
    const target = inFinalTiebreak ? format.finalSetPoints : format.tiebreakPoints;

    const tbWinner = np1 >= target && np1 - np2 >= 2 ? 1
                   : np2 >= target && np2 - np1 >= 2 ? 2 : null;

    if (tbWinner) {
      const ng1 = tbWinner === 1 ? games1 + 1 : games1;
      const ng2 = tbWinner === 2 ? games2 + 1 : games2;
      const newSet: SetScore = { games1: ng1, games2: ng2, tiebreak1: np1, tiebreak2: np2 };
      const newSets = [...completedSets, newSet];
      const matchWinner = checkMatchWinner(newSets);

      setInTiebreak(false);
      setInFinalTiebreak(false);
      setTbPoints1(0); setTbPoints2(0);

      if (matchWinner) {
        setCompletedSets(newSets);
        setGames1(0); setGames2(0);
        setWinnerId(matchWinner);
        setStatus('completed');
        emit(newSets, 0, 0, '0', '0', matchWinner);
      } else {
        setCompletedSets(newSets);
        setGames1(0); setGames2(0);
        emit(newSets, 0, 0, '0', '0');
      }
    } else {
      setTbPoints1(np1);
      setTbPoints2(np2);
      emit(completedSets, games1, games2, `${np1}`, `${np2}`);
    }
  };

  const startMatch = () => {
    socketRef.current?.emit('matchStarted', { matchId });
    setStatus('live');
  };

  if (!match) return <div style={{ padding: '24px', color: '#6B7280' }}>Cargando...</div>;

  const setsToWin = Math.ceil(format.sets / 2);
  let s1 = 0, s2 = 0;
  completedSets.forEach(s => { if (s.games1 > s.games2) s1++; else s2++; });

  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '16px 24px', borderRadius: '10px', border: 'none',
    cursor: 'pointer', fontSize: '16px', fontWeight: '700',
    backgroundColor: color, color: 'white', minWidth: '140px',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '16px' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1B3A1B', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: '#86EFAC', fontSize: '12px', fontWeight: '600' }}>{match.category} · {match.round}</p>
          <p style={{ color: 'white', fontSize: '18px', fontWeight: '700' }}>
            {match.player1Name} vs {match.player2Name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a
            href={`/live/${matchId}`}
            target="_blank"
            rel="noreferrer"
            style={{ backgroundColor: '#2D6A2D', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}
          >
            Ver marcador público
          </a>
          {status === 'pending' && (
            <button onClick={startMatch} style={{ backgroundColor: '#EF4444', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
              Iniciar partido
            </button>
          )}
        </div>
      </div>

      {/* Marcador */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280' }}>Jugador</th>
              {completedSets.map((_, i) => (
                <th key={i} style={{ padding: '8px', textAlign: 'center', color: '#6B7280', width: '48px' }}>S{i + 1}</th>
              ))}
              {status === 'live' && !winnerId && (
                <>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#2D6A2D', width: '48px' }}>
                    {inTiebreak || inFinalTiebreak ? 'TB' : `S${completedSets.length + 1}`}
                  </th>
                  {!inTiebreak && !inFinalTiebreak && (
                    <th style={{ padding: '8px', textAlign: 'center', color: '#92400E', width: '48px' }}>Pts</th>
                  )}
                </>
              )}
              <th style={{ padding: '8px', textAlign: 'center', color: '#6B7280', width: '32px' }}>Sets</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: match.player1Name, id: match.player1Id, pIdx: points1, tbIdx: tbPoints1, sets: s1 },
              { name: match.player2Name, id: match.player2Id, pIdx: points2, tbIdx: tbPoints2, sets: s2 },
            ].map((p, idx) => {
              const isWinner = winnerId === p.id;
              const isP1 = idx === 0;
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #F3F4F6', backgroundColor: isWinner ? '#F0FDF4' : 'white' }}>
                  <td style={{ padding: '12px', fontWeight: '600', color: isWinner ? '#15803D' : '#1B3A1B' }}>
                    {p.name} {isWinner && '✓'}
                  </td>
                  {completedSets.map((s, i) => {
                    const won = isP1 ? s.games1 > s.games2 : s.games2 > s.games1;
                    return (
                      <td key={i} style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: won ? '#15803D' : '#374151' }}>
                        {isP1 ? s.games1 : s.games2}
                        {s.tiebreak1 !== undefined && (
                          <sup style={{ fontSize: '9px', color: '#6B7280' }}>{isP1 ? s.tiebreak1 : s.tiebreak2}</sup>
                        )}
                      </td>
                    );
                  })}
                  {status === 'live' && !winnerId && (
                    <>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800', fontSize: '18px', color: '#1B3A1B', backgroundColor: '#F0FDF4' }}>
                        {inTiebreak || inFinalTiebreak ? p.tbIdx : isP1 ? games1 : games2}
                      </td>
                      {!inTiebreak && !inFinalTiebreak && (
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#92400E' }}>
                          {p.pIdx}
                        </td>
                      )}
                    </>
                  )}
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800', fontSize: '16px', color: p.sets >= setsToWin ? '#15803D' : '#374151' }}>
                    {p.sets}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Controles */}
      {status === 'live' && !winnerId && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {inTiebreak || inFinalTiebreak ? (
            <>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '16px', textAlign: 'center' }}>
                {inFinalTiebreak ? `Match Tiebreak a ${format.finalSetPoints} pts` : `Tiebreak a ${format.tiebreakPoints} pts`}
                <span style={{ fontSize: '11px', color: '#6B7280', marginLeft: '8px' }}>(diferencia de 2)</span>
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>{match.player1Name}</p>
                  <button onClick={() => addTiebreakPoint(1)} style={btnStyle('#1B3A1B')}>
                    +1 ({tbPoints1})
                  </button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>{match.player2Name}</p>
                  <button onClick={() => addTiebreakPoint(2)} style={btnStyle('#1B4ED8')}>
                    +1 ({tbPoints2})
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '4px', textAlign: 'center' }}>
                Set {completedSets.length + 1} — Games: {games1} - {games2}
              </p>
              <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', textAlign: 'center' }}>
                Puntos: {points1} - {points2} · {format.withAd ? 'Con Ad' : 'Sin Ad'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>{match.player1Name}</p>
                  <button onClick={() => addPoint(1)} style={btnStyle('#1B3A1B')}>
                    Punto ({points1})
                  </button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>{match.player2Name}</p>
                  <button onClick={() => addPoint(2)} style={btnStyle('#1B4ED8')}>
                    Punto ({points2})
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'center', marginBottom: '8px' }}>
                  O agregar game directamente:
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button onClick={() => addGame(1)} style={{ ...btnStyle('#374151'), fontSize: '13px', padding: '8px 16px', minWidth: '100px' }}>
                    Game {match.player1Name?.split(' ')[0]}
                  </button>
                  <button onClick={() => addGame(2)} style={{ ...btnStyle('#374151'), fontSize: '13px', padding: '8px 16px', minWidth: '100px' }}>
                    Game {match.player2Name?.split(' ')[0]}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Finalizado */}
      {winnerId && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', fontWeight: '700', color: '#15803D' }}>
            Partido finalizado
          </p>
          <p style={{ color: '#374151', marginTop: '4px' }}>
            Ganador: <strong>{winnerId === match.player1Id ? match.player1Name : match.player2Name}</strong>
          </p>
          <button
            onClick={() => navigate(-1)}
            style={{ marginTop: '12px', backgroundColor: '#2D6A2D', color: 'white', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            Volver
          </button>
        </div>
      )}

      {/* Resultado manual — para partidos que ya se jugaron */}
      {!winnerId && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginTop: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#1B3A1B' }}>Ingresar resultado final</p>
              <p style={{ fontSize: '12px', color: '#6B7280' }}>Para partidos que ya se jugaron sin marcador en vivo</p>
            </div>
            <button
              onClick={() => setShowManualResult(!showManualResult)}
              style={{ backgroundColor: showManualResult ? '#F3F4F6' : '#1B3A1B', color: showManualResult ? '#374151' : 'white', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              {showManualResult ? 'Cancelar' : 'Ingresar resultado'}
            </button>
          </div>

          {showManualResult && (
            <div>
              {/* Sets */}
              <div style={{ marginBottom: '16px' }}>
                {manualSets.map((s, i) => (
                  <div key={i} style={{ marginBottom: '12px', backgroundColor: '#F9FAFB', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
                      Set {i + 1}
                      {i === manualSets.length - 1 && manualSets.length > 2 && (
                        <button
                          onClick={() => setManualSets(manualSets.slice(0, -1))}
                          style={{ marginLeft: '8px', fontSize: '10px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          quitar
                        </button>
                      )}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {([
                        { label: match.player1Name, key: 'g1' as const },
                        { label: match.player2Name, key: 'g2' as const },
                      ] as { label: string; key: 'g1' | 'g2' }[]).map(({ label, key }) => (
                        <div key={key} style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px' }}>{label}</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <button
                              onClick={() => {
                                const updated = [...manualSets];
                                updated[i] = { ...updated[i], [key]: Math.max(0, updated[i][key] - 1) };
                                setManualSets(updated);
                              }}
                              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', cursor: 'pointer', fontSize: '16px' }}
                            >−</button>
                            <span style={{ fontSize: '24px', fontWeight: '800', color: '#1B3A1B', minWidth: '28px', textAlign: 'center' }}>
                              {s[key]}
                            </span>
                            <button
                              onClick={() => {
                                const updated = [...manualSets];
                                updated[i] = { ...updated[i], [key]: updated[i][key] + 1 };
                                setManualSets(updated);
                              }}
                              style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: '#2D6A2D', color: 'white', cursor: 'pointer', fontSize: '16px' }}
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tiebreak si hay empate */}
                    {s.g1 === format.gamesPerSet && s.g2 === format.gamesPerSet && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
                        <p style={{ fontSize: '11px', color: '#92400E', marginBottom: '6px', fontWeight: '600' }}>
                          Tiebreak ({s.g1}-{s.g2})
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {([
                            { label: match.player1Name, key: 'tb1' as const },
                            { label: match.player2Name, key: 'tb2' as const },
                          ] as { label: string; key: 'tb1' | 'tb2' }[]).map(({ label, key }) => (
                            <div key={key} style={{ textAlign: 'center' }}>
                              <p style={{ fontSize: '10px', color: '#6B7280', marginBottom: '4px' }}>{label}</p>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  onClick={() => {
                                    const updated = [...manualSets];
                                    updated[i] = { ...updated[i], [key]: Math.max(0, (updated[i][key] || 0) - 1) };
                                    setManualSets(updated);
                                  }}
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', cursor: 'pointer', fontSize: '14px' }}
                                >−</button>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: '#92400E', minWidth: '24px', textAlign: 'center' }}>
                                  {s[key] || 0}
                                </span>
                                <button
                                  onClick={() => {
                                    const updated = [...manualSets];
                                    updated[i] = { ...updated[i], [key]: (updated[i][key] || 0) + 1 };
                                    setManualSets(updated);
                                  }}
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', border: 'none', backgroundColor: '#92400E', color: 'white', cursor: 'pointer', fontSize: '14px' }}
                                >+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {manualSets.length < format.sets && (
                  <button
                    onClick={() => setManualSets([...manualSets, { g1: 0, g2: 0 }])}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#6B7280' }}
                  >
                    + Agregar set adicional
                  </button>
                )}
              </div>

              {/* Match Tiebreak si empate en sets */}
              {(() => {
                const ms1 = manualSets.filter(s => s.g1 > s.g2).length;
                const ms2 = manualSets.filter(s => s.g2 > s.g1).length;
                const setsToWin = Math.ceil(format.sets / 2);
                if (ms1 === setsToWin - 1 && ms2 === setsToWin - 1 && format.finalSetTiebreak) {
                  return (
                    <div style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE047', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: '#92400E', marginBottom: '8px' }}>
                        Match Tiebreak a {format.finalSetPoints} pts (diferencia de 2)
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[
                          { label: match.player1Name, key: 'mtb1' },
                          { label: match.player2Name, key: 'mtb2' },
                        ].map(({ label, key }) => (
                          <div key={key} style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>{label}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                onClick={() => {
                                  const updated = [...manualSets];
                                  const last = updated[updated.length - 1];
                                  updated[updated.length - 1] = { ...last, [key]: Math.max(0, ((last as any)[key] || 0) - 1) };
                                  setManualSets(updated);
                                }}
                                style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', cursor: 'pointer', fontSize: '14px' }}
                              >−</button>
                              <span style={{ fontSize: '20px', fontWeight: '800', color: '#92400E', minWidth: '24px', textAlign: 'center' }}>
                                {(manualSets[manualSets.length - 1] as any)?.[key] || 0}
                              </span>
                              <button
                                onClick={() => {
                                  const updated = [...manualSets];
                                  const last = updated[updated.length - 1];
                                  updated[updated.length - 1] = { ...last, [key]: ((last as any)[key] || 0) + 1 };
                                  setManualSets(updated);
                                }}
                                style={{ width: '24px', height: '24px', borderRadius: '50%', border: 'none', backgroundColor: '#92400E', color: 'white', cursor: 'pointer', fontSize: '14px' }}
                              >+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Ganador */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Ganador</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: match.player1Id, name: match.player1Name },
                    { id: match.player2Id, name: match.player2Name },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setManualWinner(p.id)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid',
                        borderColor: manualWinner === p.id ? '#2D6A2D' : '#E5E7EB',
                        backgroundColor: manualWinner === p.id ? '#F0FDF4' : 'white',
                        cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                        color: manualWinner === p.id ? '#15803D' : '#374151',
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Guardar */}
              <button
                disabled={!manualWinner}
                onClick={() => {
                  const sets = manualSets.map(s => ({
                    games1: s.g1, games2: s.g2,
                    tiebreak1: s.tb1, tiebreak2: s.tb2,
                  }));
                  socketRef.current?.emit('updateLiveScore', {
                    matchId,
                    sets,
                    currentSet: sets.length,
                    currentGames1: 0,
                    currentGames2: 0,
                    currentPoints1: '0',
                    currentPoints2: '0',
                    winnerId: manualWinner,
                    status: 'completed',
                  });
                  setWinnerId(manualWinner);
                  setStatus('completed');
                  setCompletedSets(sets);
                  setShowManualResult(false);
                }}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  backgroundColor: manualWinner ? '#2D6A2D' : '#D1D5DB',
                  color: 'white', cursor: manualWinner ? 'pointer' : 'not-allowed',
                  fontSize: '14px', fontWeight: '700',
                }}
              >
                Guardar resultado final
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
