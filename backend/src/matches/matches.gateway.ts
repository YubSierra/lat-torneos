import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MatchesService } from './matches.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/matches',
})
export class MatchesGateway {
  @WebSocketServer()
  server: Server;

  constructor(private matchesService: MatchesService) {}

  // ── UNIRSE A SALA DE TORNEO ─────────────────────
  @SubscribeMessage('joinTournament')
  handleJoinTournament(
    @MessageBody() data: { tournamentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`tournament:${data.tournamentId}`);
    client.emit('joined', { message: `Conectado al torneo ${data.tournamentId}` });
  }

  // ── UNIRSE A SALA DE PARTIDO ESPECÍFICO ─────────
  @SubscribeMessage('joinMatch')
  handleJoinMatch(
    @MessageBody() data: { matchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`match:${data.matchId}`);
    client.emit('joinedMatch', { matchId: data.matchId });
  }

  // ── ACTUALIZAR MARCADOR SET POR SET ─────────────
  @SubscribeMessage('updateLiveScore')
  async handleUpdateLiveScore(
    @MessageBody() dto: {
      matchId: string;
      sets: { games1: number; games2: number; tiebreak1?: number; tiebreak2?: number }[];
      currentSet: number;
      currentGames1: number;
      currentGames2: number;
      currentPoints1: string;
      currentPoints2: string;
      winnerId?: string;
      status?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // Guardar en BD
    const match = await this.matchesService.updateLiveScore(dto);

    // Emitir a sala del partido (público)
    this.server.to(`match:${dto.matchId}`).emit('liveScoreUpdated', {
      matchId: dto.matchId,
      sets: dto.sets,
      currentSet: dto.currentSet,
      currentGames1: dto.currentGames1,
      currentGames2: dto.currentGames2,
      currentPoints1: dto.currentPoints1,
      currentPoints2: dto.currentPoints2,
      winnerId: dto.winnerId,
      status: match.status,
    });

    // También emitir al torneo
    this.server.to(`tournament:${match.tournamentId}`).emit('scoreUpdated', {
      matchId: match.id,
      category: match.category,
      round: match.round,
      status: match.status,
      winnerId: match.winnerId,
    });

    return match;
  }

  // ── INICIAR PARTIDO ─────────────────────────────
  @SubscribeMessage('matchStarted')
  async handleMatchStarted(@MessageBody() data: { matchId: string }) {
    const match = await this.matchesService.startMatch(data.matchId);
    this.server.to(`tournament:${match.tournamentId}`).emit('matchLive', {
      matchId: match.id,
      round: match.round,
      category: match.category,
    });
    this.server.to(`match:${data.matchId}`).emit('matchStarted', { matchId: match.id });
    return match;
  }

  // ── WALKOVER ────────────────────────────────────
  @SubscribeMessage('declareWalkover')
  async handleWalkover(@MessageBody() data: { matchId: string; winnerId: string }) {
    const match = await this.matchesService.declareWalkover(data.matchId, data.winnerId);
    this.server.to(`tournament:${match.tournamentId}`).emit('walkoverdDeclared', {
      matchId: match.id, winnerId: match.winnerId, score: '6-0 6-0 (W.O.)',
    });
    this.server.to(`match:${data.matchId}`).emit('matchFinished', {
      matchId: match.id, winnerId: match.winnerId, walkover: true,
    });
    return match;
  }

  // ── EMITIR DESDE EL SERVICIO (helper) ──────────
  emitToMatch(matchId: string, event: string, data: any) {
    this.server.to(`match:${matchId}`).emit(event, data);
  }

  emitToTournament(tournamentId: string, event: string, data: any) {
    this.server.to(`tournament:${tournamentId}`).emit(event, data);
  }
}
