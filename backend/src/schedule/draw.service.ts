import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchRound, MatchStatus } from '../matches/match.entity';
import { Enrollment, EnrollmentStatus } from '../enrollments/enrollment.entity';
import { TournamentType } from '../tournaments/tournament.entity';

@Injectable()
export class DrawService {
  constructor(
    @InjectRepository(Match)
    private matchRepo: Repository<Match>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
  ) {}

  // ── GENERAR DRAW PRINCIPAL ──────────────────────
  async generateDraw(tournamentId: string, category: string, type: TournamentType) {
    // 1. Obtener jugadores inscritos y aprobados ordenados por seeding
    const enrollments = await this.enrollmentRepo.find({
      where: {
        tournamentId,
        category,
        status: EnrollmentStatus.APPROVED,
      },
      order: { seeding: 'ASC' },
    });

    const playerCount = enrollments.length;

    // Art. 23: mínimo 6 jugadores
    if (playerCount < 6) {
      throw new Error(
        `Categoría ${category}: mínimo 6 jugadores requeridos (Art. 23 LAT). ` +
        `Actualmente hay ${playerCount}.`
      );
    }

    // Art. 23: menos de 8 → Round Robin automático
    if (playerCount < 8 && type === TournamentType.ELIMINATION) {
      return this.generateRoundRobin(tournamentId, category, enrollments);
    }

    switch (type) {
      case TournamentType.ELIMINATION:
        return this.generateElimination(tournamentId, category, enrollments);
      case TournamentType.ROUND_ROBIN:
        return this.generateRoundRobin(tournamentId, category, enrollments);
      case TournamentType.MASTER:
        return this.generateMaster(tournamentId, category, enrollments);
      default:
        return this.generateElimination(tournamentId, category, enrollments);
    }
  }

  // ── ELIMINACIÓN DIRECTA CON BYES ───────────────
  private async generateElimination(
    tournamentId: string,
    category: string,
    enrollments: Enrollment[],
  ) {
    const playerCount = enrollments.length;

    // Calcular el tamaño del cuadro (siguiente potencia de 2)
    const drawSize = this.nextPowerOfTwo(playerCount);

    // Calcular cuántos BYEs se necesitan
    const byeCount = drawSize - playerCount;

    // Determinar la ronda inicial según el tamaño del cuadro
    const firstRound = this.getFirstRound(drawSize);

    // Construir el array de participantes con BYEs
    // Los BYEs van al final → los jugadores mejor rankeados los reciben
    const players = [...enrollments.map(e => e.playerId)];

    // Llenar con BYEs hasta completar el cuadro
    for (let i = 0; i < byeCount; i++) {
      players.push('BYE');
    }

    // Distribuir siembras: 1 arriba, 2 abajo, 3-4 sorteados, etc.
    const seededPlayers = this.seedPlayers(players, enrollments);

    // Generar los partidos de la primera ronda
    const matches = [];
    for (let i = 0; i < drawSize; i += 2) {
      const p1 = seededPlayers[i];
      const p2 = seededPlayers[i + 1];

      // Si alguno es BYE → el otro pasa automáticamente
      if (p1 === 'BYE' || p2 === 'BYE') {
        const winner = p1 === 'BYE' ? p2 : p1;
        const match = this.matchRepo.create({
          tournamentId,
          category,
          round: firstRound,
          player1Id: p1 === 'BYE' ? null : p1,
          player2Id: p2 === 'BYE' ? null : p2,
          winnerId: winner,
          status: MatchStatus.COMPLETED, // BYE = partido completado automáticamente
          seeding1: this.getSeedingForPlayer(p1, enrollments),
          seeding2: this.getSeedingForPlayer(p2, enrollments),
        });
        matches.push(match);
      } else {
        const match = this.matchRepo.create({
          tournamentId,
          category,
          round: firstRound,
          player1Id: p1,
          player2Id: p2,
          status: MatchStatus.PENDING,
          seeding1: this.getSeedingForPlayer(p1, enrollments),
          seeding2: this.getSeedingForPlayer(p2, enrollments),
        });
        matches.push(match);
      }
    }

    await this.matchRepo.save(matches);

    return {
      drawSize,
      playerCount,
      byeCount,
      firstRound,
      matches: matches.length,
      byes: byeCount > 0
        ? `${byeCount} BYEs asignados a las siembras más altas`
        : 'Sin BYEs — cuadro completo',
    };
  }

  // ── ROUND ROBIN ─────────────────────────────────
  private async generateRoundRobin(
    tournamentId: string,
    category: string,
    enrollments: Enrollment[],
  ) {
    const players = enrollments.map(e => e.playerId);
    const matches = [];

    // Algoritmo: cada jugador juega contra todos los demás
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const match = this.matchRepo.create({
          tournamentId,
          category,
          round: MatchRound.RR,
          player1Id: players[i],
          player2Id: players[j],
          status: MatchStatus.PENDING,
        });
        matches.push(match);
      }
    }

    await this.matchRepo.save(matches);

    return {
      type: 'round_robin',
      playerCount: players.length,
      totalMatches: matches.length,
      // Fórmula: n * (n-1) / 2
      formula: `${players.length} * (${players.length} - 1) / 2 = ${matches.length} partidos`,
    };
  }

  // ── TORNEO MÁSTER LAT ───────────────────────────
  // Art. 5: 2 grupos Round Robin + eliminatoria
  // Siembra 1 → Grupo A, Siembra 2 → Grupo B
  // Siembras 3-4 sorteadas, resto sorteados de a 1 en cada grupo
  private async generateMaster(
    tournamentId: string,
    category: string,
    enrollments: Enrollment[],
  ) {
    if (enrollments.length < 6) {
      throw new Error('Torneo Máster requiere mínimo 6 jugadores (Art. 5 LAT)');
    }

    const players = enrollments.map(e => e.playerId);
    const groupA: string[] = [];
    const groupB: string[] = [];

    // Siembra 1 → Grupo A (Art. 5)
    groupA.push(players[0]);
    // Siembra 2 → Grupo B (Art. 5)
    groupB.push(players[1]);

    // Siembras 3 y 4 → sorteo entre grupos
    if (players[2]) {
      const rand = Math.random() < 0.5;
      groupA.push(rand ? players[2] : players[3] || players[2]);
      groupB.push(rand ? players[3] || players[2] : players[2]);
    }

    // Resto → alternar entre grupos
    for (let i = 4; i < players.length; i++) {
      if (groupA.length <= groupB.length) {
        groupA.push(players[i]);
      } else {
        groupB.push(players[i]);
      }
    }

    // Generar partidos Round Robin para cada grupo
    const matches = [];

    for (let i = 0; i < groupA.length; i++) {
      for (let j = i + 1; j < groupA.length; j++) {
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round: MatchRound.RR_A,
          player1Id: groupA[i],
          player2Id: groupA[j],
          status: MatchStatus.PENDING,
        }));
      }
    }

    for (let i = 0; i < groupB.length; i++) {
      for (let j = i + 1; j < groupB.length; j++) {
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round: MatchRound.RR_B,
          player1Id: groupB[i],
          player2Id: groupB[j],
          status: MatchStatus.PENDING,
        }));
      }
    }

    await this.matchRepo.save(matches);

    return {
      type: 'master',
      groupA: { players: groupA.length, seed1: players[0] },
      groupB: { players: groupB.length, seed2: players[1] },
      totalMatches: matches.length,
      nextStep: 'Al terminar grupos: 1°A vs 2°B y 1°B vs 2°A en semifinales',
    };
  }

  // ── HELPERS ─────────────────────────────────────

  // Siguiente potencia de 2 (8→8, 9→16, 17→32)
  private nextPowerOfTwo(n: number): number {
    let power = 1;
    while (power < n) power *= 2;
    return power;
  }

  // Ronda inicial según tamaño del cuadro
  private getFirstRound(drawSize: number): MatchRound {
    const rounds = {
      64: MatchRound.R64,
      32: MatchRound.R32,
      16: MatchRound.R16,
      8:  MatchRound.QF,
    };
    return rounds[drawSize] || MatchRound.R32;
  }

  // Distribuir siembras en el cuadro
  // Siembra 1 arriba, siembra 2 abajo, resto alternados
  private seedPlayers(players: string[], enrollments: Enrollment[]): string[] {
    const seeded = new Array(players.length).fill(null);
    const unseeded = players.filter(p => p === 'BYE' ||
      !enrollments.find(e => e.playerId === p && e.seeding));

    // Siembra 1 → posición 0 (arriba del cuadro)
    if (enrollments[0]) seeded[0] = enrollments[0].playerId;

    // Siembra 2 → última posición (abajo del cuadro)
    if (enrollments[1]) seeded[players.length - 1] = enrollments[1].playerId;

    // Siembras 3-4 → mitades del cuadro (sorteadas)
    if (enrollments[2]) {
      const mid = players.length / 2;
      seeded[Math.random() < 0.5 ? mid : mid - 1] = enrollments[2].playerId;
    }
    if (enrollments[3]) {
      const mid = players.length / 2;
      const pos = seeded[mid] ? mid - 1 : mid;
      seeded[pos] = enrollments[3].playerId;
    }

    // Llenar posiciones vacías con el resto
    let idx = 0;
    for (let i = 0; i < seeded.length; i++) {
      if (!seeded[i]) {
        while (idx < unseeded.length && seeded.includes(unseeded[idx])) idx++;
        if (idx < unseeded.length) seeded[i] = unseeded[idx++];
      }
    }

    return seeded;
  }

  // Obtener el número de siembra de un jugador
  private getSeedingForPlayer(playerId: string, enrollments: Enrollment[]): number {
    if (playerId === 'BYE') return null;
    const enrollment = enrollments.find(e => e.playerId === playerId);
    return enrollment?.seeding || null;
  }
}
