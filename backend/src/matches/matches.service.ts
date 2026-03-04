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
      await this.repo.save(match);
      await this.advanceWinner(match);
    } else {
      match.status = MatchStatus.LIVE;
      await this.repo.save(match);
    }

    return match;
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
    await this.repo.save(match);
    await this.advanceWinner(match);
    return match;
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

  // ── AVANCE AUTOMÁTICO AL SIGUIENTE PARTIDO ──────
  private async advanceWinner(completedMatch: Match) {
    if (!completedMatch.winnerId) return;

    const ROUND_PROGRESSION: Record<string, string> = {
      R64:  'R32',
      R32:  'R16',
      R16:  'QF',
      QF:   'SF',
      SF:   'F',
      RR:   'QF',
      RR_A: 'SF_M',
      RR_B: 'SF_M',
      SF_M: 'F_M',
    };

    const nextRound = ROUND_PROGRESSION[completedMatch.round];
    if (!nextRound) return;

    const { tournamentId, category } = completedMatch;

    const completedInRound = await this.repo.find({
      where: { tournamentId, category, round: completedMatch.round as any, status: MatchStatus.COMPLETED },
      order: { createdAt: 'ASC' },
    });

    const completedWO = await this.repo.find({
      where: { tournamentId, category, round: completedMatch.round as any, status: MatchStatus.WO },
      order: { createdAt: 'ASC' },
    });

    const allCompleted = [...completedInRound, ...completedWO]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const allInRound = await this.repo.find({
      where: { tournamentId, category, round: completedMatch.round as any },
    });

    if (!allInRound || allInRound.length === 0) return;

    const matchIndex = allInRound
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .findIndex(m => m.id === completedMatch.id);

    if (matchIndex === -1) return;

    const pairIndex  = Math.floor(matchIndex / 2);
    const pairOffset = matchIndex % 2;

    const sortedRound = allInRound.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const partner = sortedRound[pairOffset === 0 ? matchIndex + 1 : matchIndex - 1];

    const nextRoundMatches = await this.repo.find({
      where: { tournamentId, category, round: nextRound as any },
      order: { createdAt: 'ASC' },
    });

    const existingNext = nextRoundMatches[pairIndex];

    if (existingNext) {
      if (!existingNext.player1Id) {
        existingNext.player1Id = completedMatch.winnerId;
        await this.repo.save(existingNext);
      } else if (!existingNext.player2Id) {
        existingNext.player2Id = completedMatch.winnerId;
        await this.repo.save(existingNext);
      }
    } else {
      const partnerCompleted = partner &&
        (partner.status === MatchStatus.COMPLETED || partner.status === MatchStatus.WO);

      const newMatch = this.repo.create({
        tournamentId,
        category,
        round: nextRound as any,
        player1Id: completedMatch.winnerId,
        player2Id: partnerCompleted ? partner.winnerId : null,
        status: MatchStatus.PENDING,
      });

      await this.repo.save(newMatch);
    }
  }
}
