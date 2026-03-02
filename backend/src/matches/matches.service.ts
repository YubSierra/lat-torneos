import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from './match.entity';
import { UpdateScoreDto } from './dto/update-score.dto';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private repo: Repository<Match>,
  ) {}

  // ── BUSCAR UN PARTIDO ───────────────────────────
  async findOne(id: string) {
    const match = await this.repo.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    return match;
  }

  // ── LISTAR PARTIDOS DE UN TORNEO ────────────────
  async findByTournament(tournamentId: string) {
    return this.repo.find({
      where: { tournamentId },
      order: { scheduledAt: 'ASC' },
    });
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

    // Si hay ganador, completar el partido
    if (dto.winnerId) {
      match.winnerId = dto.winnerId;
      match.status = MatchStatus.COMPLETED;
    }

    if (dto.status) {
      match.status = dto.status;
    }

    return this.repo.save(match);
  }

  // ── WALKOVER (Art. 23 LAT) ──────────────────────
  // W.O. = 6-0 6-0 automático
  // El jugador que da W.O. pierde en clasificatorio → descalificado
  async declareWalkover(matchId: string, winnerId: string) {
    const match = await this.findOne(matchId);
    match.winnerId = winnerId;
    match.status = MatchStatus.WO;
    return this.repo.save(match);
  }

  // ── RESULTADOS POR CATEGORÍA ────────────────────
  async getResultsByCategory(tournamentId: string, category: string) {
    return this.repo.find({
      where: { tournamentId, category },
      order: { round: 'ASC', scheduledAt: 'ASC' },
    });
  }

  // ── ESTADÍSTICAS DE UN JUGADOR ──────────────────
  async getPlayerStats(playerId: string) {
    const asPlayer1 = await this.repo.find({
      where: { player1Id: playerId, status: MatchStatus.COMPLETED },
    });
    const asPlayer2 = await this.repo.find({
      where: { player2Id: playerId, status: MatchStatus.COMPLETED },
    });

    const allMatches = [...asPlayer1, ...asPlayer2];
    const wins = allMatches.filter(m => m.winnerId === playerId).length;
    const losses = allMatches.length - wins;

    return {
      playerId,
      totalMatches: allMatches.length,
      wins,
      losses,
      winRate: allMatches.length > 0
        ? `${Math.round((wins / allMatches.length) * 100)}%`
        : '0%',
    };
  }
}
