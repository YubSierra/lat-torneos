import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Match, MatchStatus } from './match.entity';
import { UpdateScoreDto } from './dto/update-score.dto';
import { User } from '../users/user.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private repo: Repository<Match>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // ── HELPER: agregar nombres a partidos ──────────
  private async enrichWithNames(matches: Match[]) {
    const playerIds = [...new Set([
      ...matches.map(m => m.player1Id),
      ...matches.map(m => m.player2Id),
      ...matches.map(m => m.winnerId),
    ].filter(Boolean))];

    if (playerIds.length === 0) return matches;

    const users = await this.userRepo.find({
      where: { id: In(playerIds) },
      select: ['id', 'nombres', 'apellidos', 'email'],
    });

    const userMap = new Map(
      users.map(u => [
        u.id,
        `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
      ])
    );

    return matches.map(m => ({
      ...m,
      player1Name: userMap.get(m.player1Id) || 'BYE',
      player2Name: userMap.get(m.player2Id) || 'BYE',
      winnerName:  userMap.get(m.winnerId)  || null,
    }));
  }

  // ── BUSCAR UN PARTIDO ───────────────────────────
  async findOne(id: string) {
    const match = await this.repo.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    return match;
  }

  // ── LISTAR POR TORNEO ───────────────────────────
  async findByTournament(tournamentId: string) {
    const matches = await this.repo.find({
      where: { tournamentId },
      order: { scheduledAt: 'ASC' },
    });
    return this.enrichWithNames(matches);
  }

  // ── LISTAR POR CATEGORÍA ────────────────────────
  async findByCategory(tournamentId: string, category: string) {
    const matches = await this.repo.find({
      where: { tournamentId, category },
      order: { round: 'ASC' },
    });
    return this.enrichWithNames(matches);
  }

  // ── INICIAR PARTIDO ─────────────────────────────
  async startMatch(id: string) {
    const match = await this.findOne(id);
    match.status = MatchStatus.LIVE;
    return this.repo.save(match);
  }

  // ── ACTUALIZAR MARCADOR ─────────────────────────
  async updateScore(dto: UpdateScoreDto) {
    const match = await this.findOne(dto.matchId);
    match.sets1   = dto.sets1;
    match.sets2   = dto.sets2;
    match.games1  = dto.games1;
    match.games2  = dto.games2;
    match.points1 = dto.points1;
    match.points2 = dto.points2;

    if (dto.winnerId) {
      match.winnerId = dto.winnerId;
      match.status   = MatchStatus.COMPLETED;
    } else {
      match.status = MatchStatus.LIVE;
    }

    return this.repo.save(match);
  }

  // ── DECLARAR W.O. ───────────────────────────────
  async declareWalkover(id: string, winnerId: string) {
    const match    = await this.findOne(id);
    match.winnerId = winnerId;
    match.status   = MatchStatus.WO;
    match.sets1    = winnerId === match.player1Id ? 2 : 0;
    match.sets2    = winnerId === match.player2Id ? 2 : 0;
    match.games1   = winnerId === match.player1Id ? 12 : 0;
    match.games2   = winnerId === match.player2Id ? 12 : 0;
    return this.repo.save(match);
  }

  // ── ESTADÍSTICAS DE JUGADOR ─────────────────────
  async getPlayerStats(playerId: string) {
    const asPlayer1 = await this.repo.find({ where: { player1Id: playerId } });
    const asPlayer2 = await this.repo.find({ where: { player2Id: playerId } });
    const all = [...asPlayer1, ...asPlayer2];

    const completed = all.filter(m => m.status === MatchStatus.COMPLETED);
    const wins      = completed.filter(m => m.winnerId === playerId);

    return {
      playerId,
      totalMatches: completed.length,
      wins:         wins.length,
      losses:       completed.length - wins.length,
      winRate:      completed.length > 0
        ? Math.round((wins.length / completed.length) * 100)
        : 0,
    };
  }
}
