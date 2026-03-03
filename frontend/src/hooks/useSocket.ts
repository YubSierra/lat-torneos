import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(tournamentId: string) {
  const socketRef = useRef<Socket | null>(null);
  const [scores, setScores] = useState<Record<string, any>>({});
  const [liveMatches, setLiveMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!tournamentId) return;

    // Conectar al namespace de partidos
    socketRef.current = io('http://localhost:3000/matches', {
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    // Unirse a la sala del torneo
    socket.on('connect', () => {
      socket.emit('joinTournament', { tournamentId });
    });

    // Recibir actualización de marcador
    socket.on('scoreUpdated', (data: any) => {
      setScores(prev => ({
        ...prev,
        [data.matchId]: data.score,
      }));
    });

    // Recibir partido en vivo
    socket.on('matchLive', (data: any) => {
      setLiveMatches(prev => {
        const exists = prev.find(m => m.matchId === data.matchId);
        if (exists) return prev;
        return [...prev, data];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [tournamentId]);

  const updateScore = (data: any) => {
    socketRef.current?.emit('updateScore', data);
  };

  const startMatch = (matchId: string) => {
    socketRef.current?.emit('matchStarted', { matchId });
  };

  const declareWalkover = (matchId: string, winnerId: string) => {
    socketRef.current?.emit('declareWalkover', { matchId, winnerId });
  };

  return { scores, liveMatches, updateScore, startMatch, declareWalkover };
}