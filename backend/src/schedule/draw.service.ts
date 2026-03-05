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
  async generateDraw(
    tournamentId: string,
    category: string,
    type: TournamentType,
    advancingPerGroup: number = 1, // 1 o 2 jugadores por grupo pasan al MD
    modality: string = 'singles',
    roundGameFormats: Record<string, any> = {},
  ) {
    if (modality === 'doubles') {
      return this.generateDoublesDraw(tournamentId, category, type, advancingPerGroup);
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
        return this.generateRoundRobinGroups(tournamentId, category, enrollments, advancingPerGroup, roundGameFormats);
      case TournamentType.MASTER:
        return this.generateMaster(tournamentId, category, enrollments);
      default:
        return this.generateElimination(tournamentId, category, enrollments, roundGameFormats);
    }
  }

  // ── ROUND ROBIN POR GRUPOS ──────────────────────
  // Grupos de 3 o 4 jugadores, todos contra todos dentro del grupo
  // Pasan al Main Draw: 1 o 2 por grupo según elija el referee
  private async generateRoundRobinGroups(
    tournamentId: string,
    category: string,
    enrollments: Enrollment[],
    advancingPerGroup: number,
    roundGameFormats: Record<string, any> = {},
  ) {
    const players = enrollments.map(e => e.playerId);
    const totalPlayers = players.length;

    // ── FORMAR GRUPOS DE 3 O 4 ──────────────────
    const groups = this.formGroups(players, enrollments);

    const matches = [];
    const groupSummary = [];

    groups.forEach((group, groupIdx) => {
      const groupLabel = String.fromCharCode(65 + groupIdx); // A, B, C...

      // Todos contra todos dentro del grupo
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          matches.push(this.matchRepo.create({
            tournamentId,
            category,
            round: MatchRound.RR,
            player1Id: group[i],
            player2Id: group[j],
            status: MatchStatus.PENDING,
            groupLabel,
            seeding1: this.getSeedingForPlayer(group[i], enrollments),
            seeding2: this.getSeedingForPlayer(group[j], enrollments),
            gameFormat: roundGameFormats['RR'] || roundGameFormats['default'] || null,
          }));
        }
      }

      groupSummary.push({
        group: `Grupo ${groupLabel}`,
        players: group.length,
        matches: (group.length * (group.length - 1)) / 2,
        advancing: advancingPerGroup,
      });
    });

    await this.matchRepo.save(matches);

    // Calcular cuántos pasan al Main Draw
    const totalAdvancing = groups.reduce((sum, g) => {
      return sum + Math.min(advancingPerGroup, g.length);
    }, 0);

    return {
      type: 'round_robin_groups',
      totalPlayers,
      totalGroups: groups.length,
      advancingPerGroup,
      totalAdvancingToMainDraw: totalAdvancing,
      totalMatches: matches.length,
      groups: groupSummary,
      nextStep: `Al terminar los grupos, ${totalAdvancing} jugadores pasan al Main Draw de eliminación directa`,
    };
  }

  // ── FORMAR GRUPOS DE 3 O 4 ──────────────────────
  // Lógica: preferir grupos de 4, si sobran 1→un grupo de 3, si sobran 2→dos de 3 o ajustar
  private formGroups(players: string[], enrollments: Enrollment[]): string[][] {
    const total = players.length;
    const groups: string[][] = [];

    // Determinar número de grupos y tamaño
    let numGroups: number;
    let groupSize: number;

    if (total <= 4) {
      // Un solo grupo
      numGroups = 1;
      groupSize = total;
    } else if (total <= 6) {
      // 2 grupos
      numGroups = 2;
      groupSize = Math.ceil(total / 2);
    } else {
      // Grupos de 4 preferiblemente
      numGroups = Math.ceil(total / 4);
      groupSize = 4;
    }

    // Inicializar grupos vacíos
    for (let i = 0; i < numGroups; i++) groups.push([]);

    // Distribuir siembras primero: siembra 1 → grupo A, siembra 2 → grupo B, etc.
    const seeded   = enrollments.filter(e => e.seeding).sort((a, b) => a.seeding - b.seeding);
    const unseeded = players.filter(p => !enrollments.find(e => e.playerId === p && e.seeding));

    // Siembras: una por grupo en orden serpentina
    seeded.forEach((e, idx) => {
      const groupIdx = idx % numGroups;
      if (groups[groupIdx].length < (groupSize + 1)) {
        groups[groupIdx].push(e.playerId);
      } else {
        // Si el grupo está lleno, buscar el siguiente disponible
        const available = groups.findIndex(g => g.length < groupSize);
        if (available >= 0) groups[available].push(e.playerId);
      }
    });

    // Mezclar los no sembrados y distribuirlos equitativamente
    const shuffled = this.shuffle([...unseeded]);
    shuffled.forEach(playerId => {
      // Buscar el grupo con menos jugadores que aún tenga espacio
      const target = groups
        .map((g, i) => ({ i, len: g.length }))
        .filter(({ len }) => len < groupSize + 1)
        .sort((a, b) => a.len - b.len)[0];

      if (target) groups[target.i].push(playerId);
    });

    // Balancear: si algún grupo tiene 5+ jugadores, mover al siguiente
    this.balanceGroups(groups);

    return groups.filter(g => g.length > 0);
  }

  // Balancear grupos para que ninguno tenga más de 4
  private balanceGroups(groups: string[][]) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i].length > 4) {
          // Buscar grupo con menos de 4
          const target = groups.findIndex((g, j) => j !== i && g.length < 4);
          if (target >= 0) {
            groups[target].push(groups[i].pop()!);
            changed = true;
          } else {
            // Crear nuevo grupo
            groups.push([groups[i].pop()!]);
            changed = true;
          }
        }
      }
    }
  }

  // ── ELIMINACIÓN DIRECTA CON BYES ───────────────
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

    const seeded = this.seedPlayers(players, enrollments);
    const matches = [];

    for (let i = 0; i < drawSize; i += 2) {
      const p1 = seeded[i];
      const p2 = seeded[i + 1];

      if (p1 === 'BYE' || p2 === 'BYE') {
        const winner = p1 === 'BYE' ? p2 : p1;
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round: firstRound,
          player1Id: p1 === 'BYE' ? null : p1,
          player2Id: p2 === 'BYE' ? null : p2,
          winnerId: winner,
          status: MatchStatus.COMPLETED,
          seeding1: this.getSeedingForPlayer(p1, enrollments),
          seeding2: this.getSeedingForPlayer(p2, enrollments),
          gameFormat: roundGameFormats[firstRound] || roundGameFormats['default'] || null,
        }));
      } else {
        matches.push(this.matchRepo.create({
          tournamentId, category,
          round: firstRound,
          player1Id: p1,
          player2Id: p2,
          status: MatchStatus.PENDING,
          seeding1: this.getSeedingForPlayer(p1, enrollments),
          seeding2: this.getSeedingForPlayer(p2, enrollments),
          gameFormat: roundGameFormats[firstRound] || roundGameFormats['default'] || null,
        }));
      }
    }

    await this.matchRepo.save(matches);

    return {
      drawSize, playerCount, byeCount, firstRound,
      matches: matches.length,
      byes: byeCount > 0
        ? `${byeCount} BYEs asignados a las siembras más altas`
        : 'Sin BYEs — cuadro completo',
    };
  }

  // ── TORNEO MÁSTER LAT ───────────────────────────
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

    groupA.push(players[0]); // Siembra 1 → Grupo A
    groupB.push(players[1]); // Siembra 2 → Grupo B

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
    const rounds = {
      64: MatchRound.R64, 32: MatchRound.R32,
      16: MatchRound.R16, 8:  MatchRound.QF,
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

  // ── DRAW DE DOBLES ──────────────────────────────
  private async generateDoublesDraw(
    tournamentId: string,
    category: string,
    type: TournamentType,
    advancingPerGroup: number,
  ) {
    // Obtener parejas aprobadas
    const teams = await this.matchRepo.manager
      .getRepository('doubles_teams')
      .find({
        where: { tournamentId, category, status: 'approved' },
        order: { seeding: 'ASC' },
      });

    if (teams.length < 2) {
      throw new Error(
        `Dobles categoría ${category}: mínimo 2 parejas aprobadas. ` +
        `Actualmente hay ${teams.length}.`
      );
    }

    // Convertir parejas a "jugadores" para reutilizar la lógica
    // player1Id = id de la pareja (DoublesTeam.id)
    const fakeEnrollments = teams.map((t: any, idx: number) => ({
      playerId: t.id,   // usamos el ID de la pareja
      category,
      seeding: t.seeding || null,
      status: 'approved',
    })) as any[];

    if (type === TournamentType.ROUND_ROBIN) {
      return this.generateRoundRobinGroups(
        tournamentId, `${category}_DOBLES`, fakeEnrollments, advancingPerGroup
      );
    }

    return this.generateElimination(tournamentId, `${category}_DOBLES`, fakeEnrollments);
  }
}