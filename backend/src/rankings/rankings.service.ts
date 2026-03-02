import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ranking } from './ranking.entity';
import { RankingHistory } from './ranking-history.entity';
import { Match, MatchStatus, MatchRound } from '../matches/match.entity';
import { Enrollment } from '../enrollments/enrollment.entity';

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
  ) {}

  // ── TABLA DE PUNTOS ART. 7 LAT ──────────────────
  // Sencillos: Campeón 50, Subcampeón 35, SF 25...
  // Dobles: 25% de los puntos de sencillos
  // Máster: puntuación especial
  private getBasePoints(round: string, modality: string, isMaster: boolean): number {
    if (isMaster) {
      const masterPoints = {
        'F_M':  100,  // Campeón Máster
        'SF_M': 70,   // Finalista Máster
        'RR_A': 50,   // SF Máster (primero de grupo)
        'RR_B': 36,   // 3° cuadro Máster
      };
      return masterPoints[round] || 20;
    }

    // Puntos sencillos (Art. 7)
    const singlesPoints = {
      'F':   50,   // Campeón
      'SF':  35,   // Subcampeón / SF
      'QF':  25,   // Cuartos
      'R16': 18,   // Ronda de 16
      'R32': 10,   // Ronda de 32
      'R64': 6,    // Ronda de 64
      'RR':  2,    // Round Robin (participación)
    };

    const points = singlesPoints[round] || 0;

    // Dobles: 25% de los puntos de sencillos (Art. 7)
    if (modality === 'doubles') {
      return Math.round(points * 0.25);
    }

    return points;
  }

  // ── BONOS DE MÉRITOS ART. 8 LAT ────────────────
  // +8pts si vences siembra 1
  // +6pts si vences siembra 2
  // +4pts si vences siembras 3-4
  // +2pts si vences siembras 5-8
  // NO aplica en: Round Robin, W.O., Torneo Máster, Dobles
  private getMeritBonus(
    opponentSeeding: number,
    round: string,
    modality: string,
    isMaster: boolean,
  ): number {
    // Art. 8: no aplica en estos casos
    if (
      isMaster ||
      modality === 'doubles' ||
      round === 'RR' ||
      !opponentSeeding
    ) return 0;

    if (opponentSeeding === 1) return 8;
    if (opponentSeeding === 2) return 6;
    if (opponentSeeding <= 4)  return 4;
    if (opponentSeeding <= 8)  return 2;
    return 0;
  }

  // ── CALCULAR Y GUARDAR PUNTOS AL COMPLETAR PARTIDO
  async calculateMatchPoints(matchId: string) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match || match.status !== MatchStatus.COMPLETED) return;
    if (!match.winnerId) return;

    const isMaster = ['RR_A', 'RR_B', 'SF_M', 'F_M'].includes(match.round);

    // Obtener inscripción del ganador para saber la modalidad
    const enrollment = await this.enrollmentRepo.findOne({
      where: {
        tournamentId: match.tournamentId,
        playerId: match.winnerId,
      },
    });

    const modality = enrollment?.modality || 'singles';
    const season = new Date().getFullYear();

    // Calcular puntos base (Art. 7)
    const basePoints = this.getBasePoints(match.round, modality, isMaster);

    // Calcular bono de méritos (Art. 8)
    // Obtener la siembra del perdedor
    const loserSeeding = match.winnerId === match.player1Id
      ? match.seeding2
      : match.seeding1;

    const meritBonus = this.getMeritBonus(
      loserSeeding,
      match.round,
      modality,
      isMaster,
    );

    const totalPoints = basePoints + meritBonus;

    // Guardar en historial
    await this.historyRepo.save({
      playerId: match.winnerId,
      tournamentId: match.tournamentId,
      tournamentName: '',
      circuitLine: '',
      category: match.category,
      roundReached: match.round,
      basePoints,
      meritBonus,
      totalPoints,
      modality,
      season,
    });

    // Actualizar escalafón acumulado
    await this.updateRanking(
      match.winnerId,
      match.category,
      totalPoints,
      meritBonus,
      season,
    );

    return { basePoints, meritBonus, totalPoints };
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
    return this.rankingRepo.find({
      where: { category, circuitLine, season },
      order: { position: 'ASC' },
    });
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
