import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Ranking } from './ranking.entity';
import { RankingHistory } from './ranking-history.entity';
import { Match, MatchStatus, MatchRound } from '../matches/match.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { CircuitLine, CircuitRankingPoints, DEFAULT_LAT_RANKING_POINTS } from '../circuit-lines/circuit-line.entity';

@Injectable()
export class RankingsService {
  constructor(
    @InjectRepository(Ranking)
    private rankingRepo: Repository<Ranking>,
    @InjectRepository(RankingHistory)
    private historyRepo: Repository<RankingHistory>,
    @InjectRepository(Match)
    private matchRepo: Repository<Match>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Tournament)
    private tournamentRepo: Repository<Tournament>,
    @InjectRepository(CircuitLine)
    private circuitLineRepo: Repository<CircuitLine>,
  ) {}

  /** Load ranking point config for a tournament's circuit line.
   *  Returns null if the circuit line has ranking disabled. */
  private async getPoints(tournamentId: string): Promise<CircuitRankingPoints | null> {
    const tournament = await this.tournamentRepo.findOne({ where: { id: tournamentId } });
    if (!tournament) return DEFAULT_LAT_RANKING_POINTS;
    const cl = await this.circuitLineRepo.findOne({ where: { slug: tournament.circuitLine } });
    if (!cl) return DEFAULT_LAT_RANKING_POINTS;
    // Explicit null means "no ranking"
    if (cl.rankingPoints === null) return null;
    return cl.rankingPoints;
  }

  // ── TABLA DE PUNTOS (dinámica por línea de circuito) ───────────────────────
  private resolveChampionPoints(round: string, modality: string, pts: CircuitRankingPoints): number {
    if (round === 'F_M') return pts.master.champion;
    if (modality === 'doubles') return pts.doubles.champion;
    return pts.singles.champion;
  }

  private resolveEliminatedPoints(round: string, modality: string, isMaster: boolean, pts: CircuitRankingPoints): number {
    if (isMaster) {
      return (pts.master as any)[round] ?? 0;
    }
    const table = modality === 'doubles' ? pts.doubles : pts.singles;
    return (table as any)[round] ?? 0;
  }

  private resolveMeritBonus(
    opponentSeeding: number,
    round: string,
    modality: string,
    isMaster: boolean,
    pts: CircuitRankingPoints,
  ): number {
    if (isMaster || modality === 'doubles' || ['RR', 'RR_A', 'RR_B'].includes(round) || !opponentSeeding) return 0;
    if (opponentSeeding === 1) return pts.merit.seed1;
    if (opponentSeeding === 2) return pts.merit.seed2;
    if (opponentSeeding <= 4)  return pts.merit.seeds34;
    if (opponentSeeding <= 8)  return pts.merit.seeds58;
    return 0;
  }

  // Cuántas victorias tiene un jugador en el torneo (incluye W.O.)
  private async countWinsInTournament(tournamentId: string, playerId: string): Promise<number> {
    return this.matchRepo.count({
      where: {
        tournamentId,
        winnerId: playerId,
        status: In([MatchStatus.COMPLETED, MatchStatus.WO]),
      },
    });
  }

  // ── CALCULAR Y GUARDAR PUNTOS AL COMPLETAR PARTIDO ───────────────────────────
  async calculateMatchPoints(matchId: string) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) return;
    if (match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.WO) return;
    if (!match.winnerId) return;

    const pts = await this.getPoints(match.tournamentId);
    // Circuit line has ranking disabled — skip entirely
    if (pts === null) return { basePoints: 0, meritBonus: 0, totalPoints: 0, skipped: true };
    const round    = match.round as string;
    const isWO     = match.status === MatchStatus.WO;
    const isRR     = ['RR', 'RR_A', 'RR_B'].includes(round);
    const isMaster = ['RR_A', 'RR_B', 'SF_M', 'F_M'].includes(round);
    const isFinal  = round === 'F' || round === 'F_M';

    const enrollment = await this.enrollmentRepo.findOne({
      where: { tournamentId: match.tournamentId, playerId: match.winnerId },
    });
    const modality = enrollment?.modality || 'singles';
    const season   = new Date().getFullYear();

    const loserId = match.winnerId === match.player1Id
      ? match.player2Id
      : match.player1Id;

    const loserSeeding = match.winnerId === match.player1Id
      ? match.seeding2
      : match.seeding1;

    // ── 1. Round Robin: pts por victoria (fase de grupos, no máster) ──────
    if (isRR && !isMaster) {
      const rrPts = pts.rrWinPoints;
      await this.saveHistory(match.winnerId, match, rrPts, 0, modality, season);
      await this.updateRanking(match.winnerId, match.category, rrPts, 0, season);
      return { basePoints: rrPts, meritBonus: 0, totalPoints: rrPts };
    }

    // ── 2. Puntos al ELIMINADO (perdedor de la ronda) ─────────────────────
    if (loserId) {
      const loserPts = this.resolveEliminatedPoints(round, modality, isMaster, pts);
      if (loserPts > 0) {
        const loserWins = isMaster
          ? 1
          : await this.countWinsInTournament(match.tournamentId, loserId);
        if (loserWins > 0) {
          await this.saveHistory(loserId, match, loserPts, 0, modality, season);
          await this.updateRanking(loserId, match.category, loserPts, 0, season);
        }
      }
    }

    // ── 3. Puntos al CAMPEÓN (ganador de la final) ────────────────────────
    if (isFinal) {
      const champPts   = this.resolveChampionPoints(round, modality, pts);
      const meritBonus = (!isMaster && !isWO)
        ? this.resolveMeritBonus(loserSeeding, round, modality, false, pts)
        : 0;
      await this.saveHistory(match.winnerId, match, champPts, meritBonus, modality, season);
      await this.updateRanking(match.winnerId, match.category, champPts + meritBonus, meritBonus, season);
      return { basePoints: champPts, meritBonus, totalPoints: champPts + meritBonus };
    }

    // ── 4. Bono de méritos al GANADOR (rondas previas a la final) ─────────
    if (!isRR && !isMaster && !isWO) {
      const meritBonus = this.resolveMeritBonus(loserSeeding, round, modality, false, pts);
      if (meritBonus > 0) {
        await this.saveHistory(match.winnerId, match, 0, meritBonus, modality, season);
        await this.updateRanking(match.winnerId, match.category, meritBonus, meritBonus, season);
      }
    }

    return { basePoints: 0, meritBonus: 0, totalPoints: 0 };
  }

  // ── HISTORIAL: guardar registro por partido ──────────────────────────────────
  private async saveHistory(
    playerId: string,
    match: Match,
    basePoints: number,
    meritBonus: number,
    modality: string,
    season: number,
  ) {
    await this.historyRepo.save({
      playerId,
      tournamentId: match.tournamentId,
      tournamentName: '',
      circuitLine: '',
      category: match.category,
      roundReached: match.round,
      basePoints,
      meritBonus,
      totalPoints: basePoints + meritBonus,
      modality,
      season,
    });
  }

  // ── ACTUALIZAR POSICIÓN EN ESCALAFÓN ───────────
  private async updateRanking(
    playerId: string,
    category: string,
    points: number,
    meritBonus: number,
    season: number,
  ) {
    let ranking = await this.rankingRepo.findOne({
      where: { playerId, category, season },
    });

    if (!ranking) {
      ranking = this.rankingRepo.create({
        playerId,
        category,
        circuitLine: 'departamental',
        totalPoints: 0,
        meritPoints: 0,
        tournamentsPlayed: 0,
        season,
      });
    }

    ranking.totalPoints = Number(ranking.totalPoints) + points;
    ranking.meritPoints = Number(ranking.meritPoints) + meritBonus;
    ranking.tournamentsPlayed += 1;

    await this.rankingRepo.save(ranking);

    // Recalcular posiciones de todos en esa categoría
    await this.recalculatePositions(category, season);
  }

  // ── RECALCULAR POSICIONES ───────────────────────
  private async recalculatePositions(category: string, season: number) {
    const rankings = await this.rankingRepo.find({
      where: { category, season },
      order: { totalPoints: 'DESC' },
    });

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].position = i + 1;
    }

    await this.rankingRepo.save(rankings);
  }

  // ── DESEMPATE ROUND ROBIN (ITF) ─────────────────
  // 4 criterios en cascada:
  // 1. H2H (resultado directo entre empatados)
  // 2. % sets ganados
  // 3. % games ganados
  // 4. Sorteo
  async tiebreakRoundRobin(tournamentId: string, category: string) {
    const matches = await this.matchRepo.find({
      where: {
        tournamentId,
        category,
        status: MatchStatus.COMPLETED,
      },
    });

    // Construir tabla de posiciones
    const stats: Record<string, {
      wins: number; losses: number;
      setsWon: number; setsLost: number;
      gamesWon: number; gamesLost: number;
    }> = {};

    for (const match of matches) {
      if (!stats[match.player1Id]) {
        stats[match.player1Id] = {
          wins: 0, losses: 0,
          setsWon: 0, setsLost: 0,
          gamesWon: 0, gamesLost: 0,
        };
      }
      if (!stats[match.player2Id]) {
        stats[match.player2Id] = {
          wins: 0, losses: 0,
          setsWon: 0, setsLost: 0,
          gamesWon: 0, gamesLost: 0,
        };
      }

      if (match.winnerId === match.player1Id) {
        stats[match.player1Id].wins++;
        stats[match.player2Id].losses++;
      } else {
        stats[match.player2Id].wins++;
        stats[match.player1Id].losses++;
      }
    }

    // Ordenar por criterios ITF
    const sorted = Object.entries(stats).sort(([, a], [, b]) => {
      // 1. Más victorias
      if (b.wins !== a.wins) return b.wins - a.wins;

      // 2. % sets ganados
      const setPctA = a.setsWon / (a.setsWon + a.setsLost || 1);
      const setPctB = b.setsWon / (b.setsWon + b.setsLost || 1);
      if (setPctB !== setPctA) return setPctB - setPctA;

      // 3. % games ganados
      const gamePctA = a.gamesWon / (a.gamesWon + a.gamesLost || 1);
      const gamePctB = b.gamesWon / (b.gamesWon + b.gamesLost || 1);
      if (gamePctB !== gamePctA) return gamePctB - gamePctA;

      // 4. Sorteo aleatorio
      return Math.random() - 0.5;
    });

    return sorted.map(([playerId, stats], index) => ({
      position: index + 1,
      playerId,
      ...stats,
      setPct: `${Math.round(stats.setsWon / (stats.setsWon + stats.setsLost || 1) * 100)}%`,
      gamePct: `${Math.round(stats.gamesWon / (stats.gamesWon + stats.gamesLost || 1) * 100)}%`,
    }));
  }

  // ── VER ESCALAFÓN POR CATEGORÍA ─────────────────
  async getRankings(category: string, circuitLine: string) {
    const season = new Date().getFullYear();
    const rankings = await this.rankingRepo.find({
      where: { category, circuitLine, season },
      order: { position: 'ASC' },
    });

    // Obtener nombres de jugadores
    const playerIds = rankings.map(r => r.playerId);
    if (playerIds.length === 0) return [];

    const users = await this.rankingRepo.manager
      .getRepository('users')
      .findByIds(playerIds);

    const userMap = new Map(
      users.map((u: any) => [u.id, `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email])
    );

    return rankings.map(r => ({
      ...r,
      playerName: userMap.get(r.playerId) || r.playerId,
    }));
  }

  // ── VER HISTORIAL DE UN JUGADOR ─────────────────
  async getPlayerHistory(playerId: string) {
    const season = new Date().getFullYear();
    const history = await this.historyRepo.find({
      where: { playerId, season },
      order: { createdAt: 'DESC' },
    });

    const totalPoints = history.reduce((sum, h) => sum + Number(h.totalPoints), 0);
    const totalMerit = history.reduce((sum, h) => sum + Number(h.meritBonus), 0);

    return {
      playerId,
      season,
      totalPoints,
      totalMeritBonus: totalMerit,
      tournamentsPlayed: history.length,
      history,
    };
  }
}
