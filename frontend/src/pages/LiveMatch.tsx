import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../api/axios';

interface SetScore { games1: number; games2: number; tiebreak1?: number; tiebreak2?: number; }

export default function LiveMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch]           = useState<any>(null);
  const [sets, setSets]             = useState<SetScore[]>([]);
  const [currentGames1, setCurrentGames1] = useState(0);
  const [currentGames2, setCurrentGames2] = useState(0);
  const [currentPoints1, setCurrentPoints1] = useState('0');
  const [currentPoints2, setCurrentPoints2] = useState('0');
  const [status, setStatus]         = useState('pending');
  const [winnerId, setWinnerId]     = useState<string | null>(null);
  const [connected, setConnected]   = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    api.get(`/matches/${matchId}/live`).then(res => {
      const m = res.data;
      setMatch(m);
      setStatus(m.status);
      setWinnerId(m.winnerId);
      setSets(m.setsHistory || []);
      setCurrentGames1(m.games1 || 0);
      setCurrentGames2(m.games2 || 0);
      setCurrentPoints1(m.points1 || '0');
      setCurrentPoints2(m.points2 || '0');
    });

    const socket = io('http://localhost:3000/matches', { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinMatch', { matchId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('liveScoreUpdated', (data: any) => {
      setSets(data.sets || []);
      setCurrentGames1(data.currentGames1 || 0);
      setCurrentGames2(data.currentGames2 || 0);
      setCurrentPoints1(data.currentPoints1 || '0');
      setCurrentPoints2(data.currentPoints2 || '0');
      setStatus(data.status);
      if (data.winnerId) setWinnerId(data.winnerId);
    });

    socket.on('matchStarted', () => setStatus('live'));
    socket.on('matchFinished', (data: any) => {
      setStatus('completed');
      setWinnerId(data.winnerId);
    });

    return () => { socket.disconnect(); };
  }, [matchId]);

  if (!match) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0F1F0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'white', fontSize: '18px' }}>Cargando partido...</p>
    </div>
  );

  const winner = winnerId === match.player1Id ? match.player1Name : winnerId === match.player2Id ? match.player2Name : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0F1F0F', padding: '24px', fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#1B3A1B', borderRadius: '999px', padding: '4px 16px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: status === 'live' ? '#EF4444' : '#6B7280', display: 'inline-block', animation: status === 'live' ? 'pulse 1s infinite' : 'none' }} />
          <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>
            {status === 'live' ? 'EN VIVO' : status === 'completed' ? 'FINALIZADO' : 'PRÓXIMO'}
          </span>
          <span style={{ color: '#6B7280', fontSize: '11px' }}>
            {connected ? '● Conectado' : '○ Reconectando...'}
          </span>
        </div>
        <p style={{ color: '#6B7280', fontSize: '12px', marginTop: '8px' }}>
          {match.category} · {match.round}
        </p>
      </div>

      {/* Marcador principal */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {[
          { name: match.player1Name, id: match.player1Id, seeding: match.seeding1, gamesKey: currentGames1, pointsKey: currentPoints1 },
          { name: match.player2Name, id: match.player2Id, seeding: match.seeding2, gamesKey: currentGames2, pointsKey: currentPoints2 },
        ].map((player, idx) => {
          const isWinner = winnerId === player.id;
          const isP1     = idx === 0;

          return (
            <div key={player.id} style={{
              backgroundColor: isWinner ? '#1B3A1B' : '#1A1A1A',
              border: `2px solid ${isWinner ? '#2D6A2D' : status === 'live' ? '#374151' : '#1F2937'}`,
              borderRadius: idx === 0 ? '12px 12px 0 0' : '0 0 12px 12px',
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: idx === 0 ? '2px' : '0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                {player.seeding && (
                  <span style={{ backgroundColor: '#92400E', color: '#FEF3C7', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontWeight: '700' }}>
                    [{player.seeding}]
                  </span>
                )}
                <span style={{ color: isWinner ? '#86EFAC' : 'white', fontSize: '20px', fontWeight: isWinner ? '800' : '600' }}>
                  {player.name}
                </span>
                {isWinner && <span style={{ color: '#86EFAC', fontSize: '20px' }}>✓</span>}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {sets.map((s, i) => (
                  <div key={i} style={{ minWidth: '32px', textAlign: 'center', backgroundColor: '#111', borderRadius: '4px', padding: '4px 8px' }}>
                    <span style={{ color: (isP1 ? s.games1 > s.games2 : s.games2 > s.games1) ? '#86EFAC' : '#6B7280', fontSize: '22px', fontWeight: '700' }}>
                      {isP1 ? s.games1 : s.games2}
                    </span>
                    {(s.tiebreak1 !== undefined || s.tiebreak2 !== undefined) && (
                      <span style={{ color: '#6B7280', fontSize: '10px', display: 'block' }}>
                        {isP1 ? s.tiebreak1 : s.tiebreak2}
                      </span>
                    )}
                  </div>
                ))}

                {status === 'live' && (
                  <div style={{ minWidth: '40px', textAlign: 'center', backgroundColor: '#2D6A2D', borderRadius: '4px', padding: '4px 8px' }}>
                    <span style={{ color: 'white', fontSize: '24px', fontWeight: '800' }}>
                      {isP1 ? currentGames1 : currentGames2}
                    </span>
                  </div>
                )}

                {status === 'live' && (
                  <div style={{ minWidth: '44px', textAlign: 'center', backgroundColor: '#111', borderRadius: '4px', padding: '4px 8px', border: '1px solid #374151' }}>
                    <span style={{ color: '#FCD34D', fontSize: '20px', fontWeight: '700' }}>
                      {isP1 ? currentPoints1 : currentPoints2}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {winner && (
          <div style={{ textAlign: 'center', marginTop: '20px', padding: '12px', backgroundColor: '#1B3A1B', borderRadius: '8px', border: '1px solid #2D6A2D' }}>
            <p style={{ color: '#86EFAC', fontSize: '16px', fontWeight: '700' }}>
              Ganador: {winner}
            </p>
          </div>
        )}

        {match.gameFormat && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <p style={{ color: '#4B5563', fontSize: '11px' }}>
              {match.gameFormat.sets} sets · {match.gameFormat.gamesPerSet} games ·
              {match.gameFormat.withAd ? ' Con Ad' : ' Sin Ad'} ·
              TB a {match.gameFormat.tiebreakPoints} pts
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
