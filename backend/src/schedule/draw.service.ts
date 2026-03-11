// backend/src/schedule/draw.service.ts  ← REEMPLAZA COMPLETO
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

  // ── GENERAR DRAW PRINCIPAL ──────────────────────────────────────────────────
  async generateDraw(
    tournamentId: string,
    category: string,
    type: TournamentType,
    advancingPerGroup: number  = 1,
    modality: string           = 'singles',
    roundGameFormats: Record<string, any> = {},
    minPlayersPerGroup: number = 3,   // ← NUEVO parámetro (3-6)
  ) {
    if (modality === 'doubles') {
      return this.generateDoublesDraw(tournamentId, category, type, advancingPerGroup, minPlayersPerGroup);
    }

    const enrollments = await this.enrollmentRepo.find({
      where: { tournamentId, category, status: EnrollmentStatus.APPROVED },
      order: { seeding: 'ASC' },
    });

    const playerCount = enrollments.length;

    if (playerCount < 3) {
      throw new Error(
        `Categoría ${category}: mínimo 3 jugadores requeridos. ` +
        `Actualmente hay ${playerCount}.`
      );
    }

    switch (type) {
      case TournamentType.ELIMINATION:
        return this.generateElimination(tournamentId, category, enrollments, roundGameFormats);
      case TournamentType.ROUND_ROBIN:
        return this.generateRoundRobinGroups(
          tournamentId, category, enrollments, advancingPerGroup, roundGameFormats, minPlayersPerGroup
        );
      case TournamentType.MASTER:
        return this.generateMaster(tournamentId, category, enrollments);
      default:
        return this.generateElimination(tournamentId, category, enrollments, roundGameFormats);
    }
  }

  // ── ROUND ROBIN POR GRUPOS ──────────────────────────────────────────────────
  private async generateRoundRobinGroups(
    tournamentId: string,
    category: string,
    enrollments: Enrollment[],
    advancingPerGroup: number,
    roundGameFormats: Record<string, any> = {},
    minPlayersPerGroup: number = 3,
  ) {
    const players     = enrollments.map(e => e.playerId);
    const totalPlayers = players.length;

    // ── Calcular estructura de grupos ──────────────────────────────────────
    const groupStructure = this.calcGroupStructure(totalPlayers, minPlayersPerGroup);

    // ── Distribuir jugadores respetando siembras ────────────────────────────
    const groups = this.distributePlayersIntoGroups(enrollments, groupStructure);

    const matches      = [];
    const groupSummary = [];

    groups.forEach((group, groupIdx) => {
      const groupLabel = String.fromCharCode(65 + groupIdx); // A, B, C...

      // Todos contra todos dentro del grupo
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          matches.push(this.matchRepo.create({
            tournamentId,
            category,
            round:      MatchRound.RR,
            player1Id:  group[i],
            player2Id:  group[j],
            status:     MatchStatus.PENDING,
            groupLabel,
            seeding1:   this.getSeedingForPlayer(group[i], enrollments),
            seeding2:   this.getSeedingForPlayer(group[j], enrollments),
            gameFormat: roundGameFormats['RR'] || roundGameFormats['default'] || null,
          } as any));
        }
      }

      groupSummary.push({
        group:     `Grupo ${groupLabel}`,
        players:   group.length,
        matches:   (group.length * (group.length - 1)) / 2,
        advancing: advancingPerGroup,
      });
    });

    await this.matchRepo.save(matches);

    const totalAdvancing = groups.reduce((sum, g) => sum + Math.min(advancingPerGroup, g.length), 0);

    return {
      type:                    'round_robin_groups',
      totalPlayers,
      totalGroups:             groups.length,
      minPlayersPerGroup,
      advancingPerGroup,
      totalAdvancingToMainDraw: totalAdvancing,
      totalMatches:            matches.length,
      groups:                  groupSummary,
      nextStep: `Al terminar los grupos, ${totalAdvancing} jugadores pasan al Main Draw de eliminación directa`,
    };
  }

  // ── CALCULAR ESTRUCTURA DE GRUPOS ──────────────────────────────────────────
  // Garantiza que ningún grupo quede por debajo de minPlayersPerGroup
  //
  // Algoritmo:
  //   numGroups = floor(total / min)
  //   baseSize  = floor(total / numGroups)
  //   extras    = total % numGroups   → los primeros `extras` grupos tienen baseSize+1
  //
  // Ejemplos con min=4:
  //   9  jugadores → 2 grupos: [5, 4]
  //   11 jugadores → 2 grupos: [6, 5]
  //   12 jugadores → 3 grupos: [4, 4, 4]
  //   13 jugadores → 3 grupos: [5, 4, 4]
  //   17 jugadores → 4 grupos: [5, 4, 4, 4]
  //
  // Ejemplos con min=3:
  //   7  jugadores → 2 grupos: [4, 3]
  //   10 jugadores → 3 grupos: [4, 3, 3]
  //
  private calcGroupStructure(total: number, min: number): number[] {
    if (total <= 0) return [];

    const safeMin  = Math.max(2, min);            // nunca menos de 2
    let numGroups  = Math.floor(total / safeMin);
    if (numGroups === 0) numGroups = 1;           // edge: pocos jugadores

    const baseSize = Math.floor(total / numGroups);
    const extras   = total % numGroups;

    // Primeros `extras` grupos tienen un jugador más
    return Array.from({ length: numGroups }, (_, i) =>
      i < extras ? baseSize + 1 : baseSize
    );
  }

  // ── DISTRIBUIR JUGADORES EN GRUPOS ─────────────────────────────────────────
  // Usa distribución serpentina para equilibrar siembras:
  //   Siembra 1 → Grupo 0
  //   Siembra 2 → Grupo 1
  //   Siembra 3 → Grupo 2
  //   ... cuando llega al último grupo, da la vuelta
  //   No sembrados → distribuidos al azar entre grupos con espacio
  private distributePlayersIntoGroups(
    enrollments: Enrollment[],
    groupSizes: number[],
  ): string[][] {
    const groups: string[][] = groupSizes.map(() => []);

    const seeded   = enrollments.filter(e => e.seeding > 0).sort((a, b) => a.seeding - b.seeding);
    const unseeded = this.shuffle(
      enrollments.filter(e => !(e.seeding > 0)).map(e => e.playerId)
    );

    // Distribución serpentina de sembrados
    // 0→1→2→...→n-1→n-1→...→1→0→0→...
    const numGroups = groups.length;
    let dir         = 1;
    let gIdx        = 0;

    seeded.forEach(e => {
      groups[gIdx].push(e.playerId);
      // Siguiente posición serpentina
      const next = gIdx + dir;
      if (next >= numGroups) { dir = -1; gIdx = numGroups - 1; }
      else if (next < 0)     { dir =  1; gIdx = 0; }
      else                    { gIdx = next; }
    });

    // Distribuir no sembrados: llenar grupos más vacíos primero
    unseeded.forEach(playerId => {
      // Busca el grupo con menos jugadores que aún tenga espacio según groupSizes
      const target = groups
        .map((g, i) => ({ i, len: g.length, cap: groupSizes[i] }))
        .filter(({ len, cap }) => len < cap)
        .sort((a, b) => a.len - b.len)[0];

      if (target) groups[target.i].push(playerId);
    });

    return groups.filter(g => g.length > 0);
  }

  // ── ELIMINACIÓN DIRECTA CON BYES ───────────────────────────────────────────
  private async generateElimination(
    tournamentId: string,
    category: string,
    enrollments: Enrollment[],
    roundGameFormats: Record<string, any> = {},
  ) {
    const playerCount = enrollments.length;
    const drawSize    = this.nextPowerOfTwo(playerCount);
    const byeCount    = drawSize - playerCount;
    const firstRound  = this.getFirstRound(drawSize);
    const players     = [...enrollments.map(e => e.playerId)];

    for (let i = 0; i < byeCount; i++) players.push('BYE');

    const seeded  = this.seedPlayers(players, enrollments);
    const matches = [];

    for (let i = 0; i < drawSize; i += 2) {
      const p1 = seeded[i];
      const p2 = seeded[i + 1];

      if (p1 === 'BYE' || p2 === 'BYE') {
        const winner = p1 === 'BYE' ? p2 : p1;
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round:      firstRound,
          player1Id:  p1 === 'BYE' ? null : p1,
          player2Id:  p2 === 'BYE' ? null : p2,
          winnerId:   winner,
          status:     MatchStatus.COMPLETED,
          seeding1:   this.getSeedingForPlayer(p1, enrollments),
          seeding2:   this.getSeedingForPlayer(p2, enrollments),
          gameFormat: roundGameFormats[firstRound] || roundGameFormats['default'] || null,
        }));
      } else {
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round:      firstRound,
          player1Id:  p1,
          player2Id:  p2,
          status:     MatchStatus.PENDING,
          seeding1:   this.getSeedingForPlayer(p1, enrollments),
          seeding2:   this.getSeedingForPlayer(p2, enrollments),
          gameFormat: roundGameFormats[firstRound] || roundGameFormats['default'] || null,
        }));
      }
    }

    await this.matchRepo.save(matches);

    return {
      drawSize, playerCount, byeCount, firstRound,
      matches: matches.length,
      byes:    byeCount > 0 ? `${byeCount} BYEs asignados a las siembras más altas` : 'Sin BYEs — cuadro completo',
    };
  }

  // ── TORNEO MÁSTER LAT ───────────────────────────────────────────────────────
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

    groupA.push(players[0]);
    groupB.push(players[1]);

    if (players[2]) {
      const rand = Math.random() < 0.5;
      groupA.push(rand ? players[2] : players[3] || players[2]);
      groupB.push(rand ? players[3] || players[2] : players[2]);
    }

    for (let i = 4; i < players.length; i++) {
      if (groupA.length <= groupB.length) groupA.push(players[i]);
      else groupB.push(players[i]);
    }

    const matches = [];

    for (let i = 0; i < groupA.length; i++) {
      for (let j = i + 1; j < groupA.length; j++) {
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round:     MatchRound.RR_A,
          player1Id: groupA[i],
          player2Id: groupA[j],
          status:    MatchStatus.PENDING,
        }));
      }
    }

    for (let i = 0; i < groupB.length; i++) {
      for (let j = i + 1; j < groupB.length; j++) {
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round:     MatchRound.RR_B,
          player1Id: groupB[i],
          player2Id: groupB[j],
          status:    MatchStatus.PENDING,
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

  // ── DRAW DE DOBLES ──────────────────────────────────────────────────────────
  private async generateDoublesDraw(
    tournamentId: string,
    category: string,
    type: TournamentType,
    advancingPerGroup: number,
    minPlayersPerGroup: number = 3,
  ) {
    const teams = await this.matchRepo.manager
      .getRepository('doubles_teams')
      .find({
        where:  { tournamentId, category, status: 'approved' },
        order:  { seeding: 'ASC' },
      });

    if (teams.length < 2) {
      throw new Error(
        `Dobles categoría ${category}: mínimo 2 parejas aprobadas. ` +
        `Actualmente hay ${teams.length}.`
      );
    }

    const fakeEnrollments = teams.map((t: any) => ({
      playerId: t.id,
      category,
      seeding:  t.seeding || null,
      status:   'approved',
    })) as any[];

    if (type === TournamentType.ROUND_ROBIN) {
      return this.generateRoundRobinGroups(
        tournamentId, `${category}_DOBLES`, fakeEnrollments, advancingPerGroup, {}, minPlayersPerGroup
      );
    }

    return this.generateElimination(tournamentId, `${category}_DOBLES`, fakeEnrollments);
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private nextPowerOfTwo(n: number): number {
    let power = 1;
    while (power < n) power *= 2;
    return power;
  }

  private getFirstRound(drawSize: number): MatchRound {
    const rounds: Record<number, MatchRound> = {
      64: MatchRound.R64, 32: MatchRound.R32,
      16: MatchRound.R16,  8: MatchRound.QF,
    };
    return rounds[drawSize] || MatchRound.R32;
  }

  private seedPlayers(players: string[], enrollments: Enrollment[]): string[] {
    const seeded   = new Array(players.length).fill(null);
    const unseeded = players.filter(p =>
      p === 'BYE' || !enrollments.find(e => e.playerId === p && e.seeding)
    );

    if (enrollments[0]) seeded[0] = enrollments[0].playerId;
    if (enrollments[1]) seeded[players.length - 1] = enrollments[1].playerId;
    if (enrollments[2]) {
      const mid = players.length / 2;
      seeded[Math.random() < 0.5 ? mid : mid - 1] = enrollments[2].playerId;
    }
    if (enrollments[3]) {
      const mid = players.length / 2;
      const pos = seeded[mid] ? mid - 1 : mid;
      seeded[pos] = enrollments[3].playerId;
    }

    let idx = 0;
    for (let i = 0; i < seeded.length; i++) {
      if (!seeded[i]) {
        while (idx < unseeded.length && seeded.includes(unseeded[idx])) idx++;
        if (idx < unseeded.length) seeded[i] = unseeded[idx++];
      }
    }

    return seeded;
  }

  private getSeedingForPlayer(playerId: string, enrollments: Enrollment[]): number {
    if (!playerId || playerId === 'BYE') return null;
    return enrollments.find(e => e.playerId === playerId)?.seeding || null;
  }
}