import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MatchesService } from './matches.service';
import { UpdateScoreDto } from './dto/update-score.dto';

// El gateway escucha en el mismo puerto del servidor (3000)
@WebSocketGateway({
  cors: { origin: '*' }, // Permitir conexiones del frontend
  namespace: '/matches', // Namespace específico para partidos
})
export class MatchesGateway {
  // El servidor de Socket.io
  @WebSocketServer()
  server: Server;

  constructor(private matchesService: MatchesService) {}

  // ── UNIRSE A LA SALA DE UN TORNEO ───────────────
  // El cliente se une a una sala para recibir updates de ese torneo
  @SubscribeMessage('joinTournament')
  handleJoinTournament(
    @MessageBody() data: { tournamentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`tournament:${data.tournamentId}`);
    client.emit('joined', {
      message: `Conectado al torneo ${data.tournamentId}`,
    });
  }

  // ── ACTUALIZAR MARCADOR ─────────────────────────
  // El árbitro envía este evento cuando cambia el marcador
  @SubscribeMessage('updateScore')
  async handleUpdateScore(
    @MessageBody() dto: UpdateScoreDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Guardar el marcador en la BD
    const match = await this.matchesService.updateScore(dto);

    // Emitir el nuevo marcador a TODOS los conectados al torneo
    this.server.to(`tournament:${match.tournamentId}`).emit('scoreUpdated', {
      matchId: match.id,
      round: match.round,
      category: match.category,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      winnerId: match.winnerId,
      status: match.status,
      score: {
        sets1: dto.sets1,
        sets2: dto.sets2,
        games1: dto.games1,
        games2: dto.games2,
        points1: dto.points1,
        points2: dto.points2,
      },
    });

    return match;
  }

  // ── WALKOVER ────────────────────────────────────
  // Art. 23 LAT: W.O. = 6-0 6-0 automático
  @SubscribeMessage('declareWalkover')
  async handleWalkover(
    @MessageBody() data: { matchId: string; winnerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const match = await this.matchesService.declareWalkover(
      data.matchId,
      data.winnerId,
    );

    // Notificar a todos que hubo W.O.
    this.server.to(`tournament:${match.tournamentId}`).emit('walkoverdDeclared', {
      matchId: match.id,
      winnerId: match.winnerId,
      score: '6-0 6-0 (W.O.)',
    });

    return match;
  }

  // ── PARTIDO EN VIVO ─────────────────────────────
  // Notificar que un partido está comenzando
  @SubscribeMessage('matchStarted')
  async handleMatchStarted(
    @MessageBody() data: { matchId: string },
  ) {
    const match = await this.matchesService.startMatch(data.matchId);

    this.server.to(`tournament:${match.tournamentId}`).emit('matchLive', {
      matchId: match.id,
      round: match.round,
      category: match.category,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
    });

    return match;
  }
}
