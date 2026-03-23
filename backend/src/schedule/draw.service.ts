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
    advancingPerGroup: number = 1,
    modality: string = 'singles',
    roundGameFormats: Record<string, any> = {},
    minPlayersPerGroup: number = 3, // ← NUEVO parámetro (3-6)
  ) {
    if (modality === 'doubles') {
      return this.generateDoublesDraw(
        tournamentId,
        category,
        type,
        advancingPerGroup,
        minPlayersPerGroup,
      );
    }

    const enrollments = await this.enrollmentRepo.find({
      where: { tournamentId, category, status: EnrollmentStatus.APPROVED },
      order: { seeding: 'ASC' },
    });

    const playerCount = enrollments.length;

    if (playerCount < 3) {
      throw new Error(
        `Categoría ${category}: mínimo 3 jugadores requeridos. ` +
          `Actualmente hay ${playerCount}.`,
      );
    }

    switch (type) {
      case TournamentType.ELIMINATION:
        return this.generateElimination(
          tournamentId,
          category,
          enrollments,
          roundGameFormats,
        );
      case TournamentType.ROUND_ROBIN:
        return this.generateRoundRobinGroups(
          tournamentId,
          category,
          enrollments,
          advancingPerGroup,
          roundGameFormats,
          minPlayersPerGroup,
        );
      case TournamentType.MASTER:
        return this.generateMaster(tournamentId, category, enrollments);
      default:
        return this.generateElimination(
          tournamentId,
          category,
          enrollments,
          roundGameFormats,
        );
    }
  }

  // ── EDITAR GRUPOS RR (reasignar jugadores entre grupos) ────────────────────
  async editRRGroups(
    tournamentId: string,
    category: string,
    groups: Record<string, string[]>, // { "A": [playerId,...], "B": [...] }
  ) {
    // Obtener todas las inscripciones para leer seedings y gameFormat existente
    const enrollments = await this.enrollmentRepo.find({
      where: { tournamentId, category, status: EnrollmentStatus.APPROVED },
    });

    // Leer partidos RR existentes (para preservar gameFormat y scheduling)
    const existingRRMatches = await this.matchRepo.find({
      where: { tournamentId, category, round: MatchRound.RR },
    });
    const gameFormat = existingRRMatches[0]?.gameFormat ?? null;

    // Guardar mapa de scheduling existente: "p1|p2" → { scheduledAt, courtId, status }
    const schedulingMap = new Map<
      string,
      { scheduledAt: Date | null; courtId: string | null; status: string }
    >();
    for (const m of existingRRMatches) {
      if (m.scheduledAt || m.courtId) {
        const key = [m.player1Id, m.player2Id].sort().join('|');
        schedulingMap.set(key, {
          scheduledAt: (m as any).scheduledAt ?? null,
          courtId: (m as any).courtId ?? null,
          status: m.status,
        });
      }
    }

    // Eliminar SOLO los partidos RR de la categoría (NO el Main Draw)
    await this.matchRepo.delete({
      tournamentId,
      category,
      round: MatchRound.RR,
    });

    // Recrear partidos con los nuevos grupos, restaurando scheduling si existía
    const matches = [];
    for (const [groupLabel, playerIds] of Object.entries(groups)) {
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const key = [playerIds[i], playerIds[j]].sort().join('|');
          const sched = schedulingMap.get(key);
          matches.push(
            this.matchRepo.create({
              tournamentId,
              category,
              round: MatchRound.RR,
              player1Id: playerIds[i],
              player2Id: playerIds[j],
              status: sched?.status ?? MatchStatus.PENDING,
              groupLabel,
              seeding1: this.getSeedingForPlayer(playerIds[i], enrollments),
              seeding2: this.getSeedingForPlayer(playerIds[j], enrollments),
              gameFormat,
              ...(sched?.scheduledAt ? { scheduledAt: sched.scheduledAt } : {}),
              ...(sched?.courtId ? { courtId: sched.courtId } : {}),
            } as any),
          );
        }
      }
    }
    await this.matchRepo.save(matches);

    return {
      success: true,
      totalMatches: matches.length,
      groups: Object.entries(groups).map(([g, ids]) => ({
        group: `Grupo ${g}`,
        players: ids.length,
      })),
    };
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
    // Excluir inscripciones sin playerId válido
    const validEnrollments = enrollments.filter((e) => !!e.playerId);
    const invalidCount = enrollments.length - validEnrollments.length;
    if (invalidCount > 0) {
      console.warn(
        `[Draw] ${invalidCount} inscripción(es) sin playerId válido fueron ignoradas en categoría ${category}`,
      );
    }

    const players = validEnrollments.map((e) => e.playerId);
    const totalPlayers = players.length;

    // ── Calcular estructura de grupos ──────────────────────────────────────
    const groupStructure = this.calcGroupStructure(
      totalPlayers,
      minPlayersPerGroup,
    );

    // ── Distribuir jugadores respetando siembras ────────────────────────────
    const groups = this.distributePlayersIntoGroups(
      validEnrollments,
      groupStructure,
    );

    const matches = [];
    const groupSummary = [];

    groups.forEach((group, groupIdx) => {
      const groupLabel = String.fromCharCode(65 + groupIdx); // A, B, C...

      // Todos contra todos dentro del grupo
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          matches.push(
            this.matchRepo.create({
              tournamentId,
              category,
              round: MatchRound.RR,
              player1Id: group[i],
              player2Id: group[j],
              status: MatchStatus.PENDING,
              groupLabel,
              seeding1: this.getSeedingForPlayer(group[i], enrollments),
              seeding2: this.getSeedingForPlayer(group[j], enrollments),
              gameFormat:
                roundGameFormats['RR'] || roundGameFormats['default'] || null,
            } as any),
          );
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

    const totalAdvancing = groups.reduce(
      (sum, g) => sum + Math.min(advancingPerGroup, g.length),
      0,
    );
    const isSingleGroup = groups.length === 1;

    // ── Pre-crear rondas del cuadro principal con jugadores nulos ───────────
    // Aparecen como "pendientes" desde el inicio del torneo.
    // generateMainDrawFromRR las reemplaza con los clasificados reales.
    // También se crean para grupo único si avanzan ≥2 jugadores al main draw.
    // IMPORTANTE: Si ya existen partidos del Main Draw (QF/SF/F/R16/R32),
    // NO se crean nuevos para preservar la programación existente.
    if (totalAdvancing >= 2 && (!isSingleGroup || advancingPerGroup >= 2)) {
      const existingMainDraw = await this.matchRepo.find({
        where: { tournamentId, category },
      });
      const hasMainDraw = existingMainDraw.some((m) =>
        ['R32', 'R16', 'QF', 'SF', 'F'].includes(m.round as string),
      );
      if (!hasMainDraw) {
        const ROUND_SEQ: Record<string, string> = {
          R32: 'R16',
          R16: 'QF',
          QF: 'SF',
          SF: 'F',
        };
        const drawSize = this.nextPowerOfTwo(totalAdvancing);
        const firstRound = this.getFirstRound(drawSize);
        let prevRound: any[] = [];
        let curRound = firstRound as string;

        // Crear primera ronda del main draw
        for (let i = 0; i < drawSize / 2; i++) {
          prevRound.push(
            this.matchRepo.create({
              tournamentId,
              category,
              round: firstRound as any,
              player1Id: null,
              player2Id: null,
              status: MatchStatus.PENDING,
              gameFormat:
                roundGameFormats[firstRound] ||
                roundGameFormats['default'] ||
                null,
              bracketPosition: i,
            } as any),
          );
        }
        await this.matchRepo.save(prevRound);

        // Crear rondas siguientes
        while (ROUND_SEQ[curRound]) {
          const nextRound = ROUND_SEQ[curRound];
          const nextMatches = [];
          for (let i = 0; i < prevRound.length; i += 2) {
            nextMatches.push(
              this.matchRepo.create({
                tournamentId,
                category,
                round: nextRound as any,
                player1Id: null,
                player2Id: null,
                status: MatchStatus.PENDING,
                gameFormat:
                  roundGameFormats[nextRound] ||
                  roundGameFormats['default'] ||
                  null,
                bracketPosition: i / 2,
              } as any),
            );
          }
          await this.matchRepo.save(nextMatches);
          prevRound = nextMatches;
          curRound = nextRound;
        }
      }
    }

    return {
      type: 'round_robin_groups',
      totalPlayers,
      totalGroups: groups.length,
      minPlayersPerGroup,
      advancingPerGroup,
      isSingleGroup,
      totalAdvancingToMainDraw: isSingleGroup ? 0 : totalAdvancing,
      totalMatches: matches.length,
      groups: groupSummary,
      nextStep: isSingleGroup
        ? `Torneo Round Robin completo. Con ${totalPlayers} jugadores se juega un grupo único — el líder del grupo es campeón directamente, sin Main Draw.`
        : `Al terminar los grupos, ${totalAdvancing} jugadores pasan al Main Draw de eliminación directa.`,
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

    const safeMin = Math.max(2, min); // nunca menos de 2
    let numGroups = Math.floor(total / safeMin);
    if (numGroups === 0) numGroups = 1; // edge: pocos jugadores

    const baseSize = Math.floor(total / numGroups);
    const extras = total % numGroups;

    // Primeros `extras` grupos tienen un jugador más
    return Array.from({ length: numGroups }, (_, i) =>
      i < extras ? baseSize + 1 : baseSize,
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

    // Filtrar inscripciones sin playerId válido antes de distribuir
    const validEnrollments = enrollments.filter((e) => !!e.playerId);

    const seeded = validEnrollments
      .filter((e) => e.seeding > 0)
      .sort((a, b) => a.seeding - b.seeding);
    const unseeded = this.shuffle(
      validEnrollments.filter((e) => !(e.seeding > 0)).map((e) => e.playerId),
    );

    // Distribución serpentina de sembrados: 0→1→2→...→n-1→n-2→...→1→0→1→...
    // Corrección: al rebotar en el límite, avanzar en la dirección inversa (no repetir el extremo)
    const numGroups = groups.length;
    let dir = 1;
    let gIdx = 0;

    seeded.forEach((e) => {
      groups[gIdx].push(e.playerId);
      const next = gIdx + dir;
      if (next >= numGroups) {
        dir = -1;
        gIdx = numGroups - 2; // retroceder uno desde el extremo
      } else if (next < 0) {
        dir = 1;
        gIdx = 1; // avanzar uno desde el extremo
      } else {
        gIdx = next;
      }
    });

    // Distribuir no sembrados: llenar grupos más vacíos primero
    unseeded.forEach((playerId) => {
      const target = groups
        .map((g, i) => ({ i, len: g.length, cap: groupSizes[i] }))
        .filter(({ len, cap }) => len < cap)
        .sort((a, b) => a.len - b.len)[0];

      if (target) groups[target.i].push(playerId);
    });

    return groups.filter((g) => g.length > 0);
  }

  // ── ELIMINACIÓN DIRECTA CON BYES ───────────────────────────────────────────
  private async generateElimination(
    tournamentId: string,
    category: string,
    enrollments: Enrollment[],
    roundGameFormats: Record<string, any> = {},
  ) {
    const playerCount = enrollments.length;
    const drawSize = this.nextPowerOfTwo(playerCount);
    const byeCount = drawSize - playerCount;
    const firstRound = this.getFirstRound(drawSize);

    // Build seeds: seeded players first (ranking order), then unseeded (shuffled)
    // buildITFDraw assigns BYEs to the top `byeCount` seeds automatically
    const seededEnrollments = [...enrollments]
      .filter((e) => e.seeding > 0)
      .sort((a, b) => a.seeding - b.seeding);
    const unseededEnrollments = this.shuffle(
      enrollments.filter((e) => !(e.seeding > 0)),
    );
    const seeds = [
      ...seededEnrollments.map((e) => e.playerId),
      ...unseededEnrollments.map((e) => e.playerId),
    ];

    const draw = this.buildITFDraw(seeds, byeCount, drawSize);
    const matches = [];

    for (let i = 0; i < drawSize; i += 2) {
      const p1 = draw[i];
      const p2 = draw[i + 1];
      const bracketPosition = i / 2;

      if (p1 === 'BYE' || p2 === 'BYE') {
        const winner = p1 === 'BYE' ? p2 : p1;
        matches.push(
          this.matchRepo.create({
            tournamentId,
            category,
            round: firstRound,
            player1Id: p1 === 'BYE' ? null : p1,
            player2Id: p2 === 'BYE' ? null : p2,
            winnerId: winner,
            status: MatchStatus.COMPLETED,
            seeding1: this.getSeedingForPlayer(p1, enrollments),
            seeding2: this.getSeedingForPlayer(p2, enrollments),
            gameFormat:
              roundGameFormats[firstRound] ||
              roundGameFormats['default'] ||
              null,
            bracketPosition,
          } as any),
        );
      } else {
        matches.push(
          this.matchRepo.create({
            tournamentId,
            category,
            round: firstRound,
            player1Id: p1,
            player2Id: p2,
            status: MatchStatus.PENDING,
            seeding1: this.getSeedingForPlayer(p1, enrollments),
            seeding2: this.getSeedingForPlayer(p2, enrollments),
            gameFormat:
              roundGameFormats[firstRound] ||
              roundGameFormats['default'] ||
              null,
            bracketPosition,
          } as any),
        );
      }
    }

    await this.matchRepo.save(matches);

    // ── Pre-crear rondas siguientes con jugadores nulos ─────────────────────
    // Así aparecen como "pendientes" desde el inicio aunque los jugadores
    // aún no estén definidos. advanceWinner las rellena conforme avanza el torneo.
    const ROUND_SEQUENCE: Record<string, string> = {
      R64: 'R32',
      R32: 'R16',
      R16: 'QF',
      QF: 'SF',
      SF: 'F',
    };
    let prevRound = [...matches];
    let curRound = firstRound as string;
    while (ROUND_SEQUENCE[curRound]) {
      const nextRound = ROUND_SEQUENCE[curRound];
      const nextMatches = [];
      for (let i = 0; i < prevRound.length; i += 2) {
        const m1 = prevRound[i];
        const m2 = prevRound[i + 1];
        nextMatches.push(
          this.matchRepo.create({
            tournamentId,
            category,
            round: nextRound as any,
            player1Id:
              m1?.status === MatchStatus.COMPLETED ? m1.winnerId : null,
            player2Id:
              m2?.status === MatchStatus.COMPLETED ? m2.winnerId : null,
            status: MatchStatus.PENDING,
            gameFormat:
              roundGameFormats[nextRound] ||
              roundGameFormats['default'] ||
              null,
            bracketPosition: i / 2,
          } as any),
        );
      }
      await this.matchRepo.save(nextMatches);
      prevRound = nextMatches;
      curRound = nextRound;
    }

    return {
      drawSize,
      playerCount,
      byeCount,
      firstRound,
      matches: matches.length,
      byes:
        byeCount > 0
          ? `${byeCount} BYEs asignados a las siembras más altas`
          : 'Sin BYEs — cuadro completo',
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

    const players = enrollments.map((e) => e.playerId);
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
        matches.push(
          this.matchRepo.create({
            tournamentId,
            category,
            round: MatchRound.RR_A,
            player1Id: groupA[i],
            player2Id: groupA[j],
            status: MatchStatus.PENDING,
          }),
        );
      }
    }

    for (let i = 0; i < groupB.length; i++) {
      for (let j = i + 1; j < groupB.length; j++) {
        matches.push(
          this.matchRepo.create({
            tournamentId,
            category,
            round: MatchRound.RR_B,
            player1Id: groupB[i],
            player2Id: groupB[j],
            status: MatchStatus.PENDING,
          }),
        );
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
    // Incluir parejas aprobadas O con pago confirmado (paymentStatus='approved'/'manual')
    // para cubrir equipos creados antes del fix de auto-aprobación
    const repo = this.matchRepo.manager.getRepository('doubles_teams');
    let teams = await repo.find({
      where: { tournamentId, category, status: 'approved' },
      order: { seeding: 'ASC' },
    });
    if (teams.length < 2) {
      // fallback: incluir también equipos pendientes con pago aprobado/gratuito
      const allTeams = await repo.find({
        where: { tournamentId, category },
        order: { seeding: 'ASC' },
      });
      teams = allTeams.filter(
        (t: any) =>
          t.paymentStatus === 'approved' || t.paymentStatus === 'manual',
      );
    }

    if (teams.length < 2) {
      throw new Error(
        `Dobles categoría ${category}: mínimo 2 parejas con pago confirmado. ` +
          `Actualmente hay ${teams.length}. Aprueba los pagos de las parejas antes de generar el cuadro.`,
      );
    }

    const fakeEnrollments = teams.map((t: any) => ({
      playerId: t.id,
      category,
      seeding: t.seeding || null,
      status: 'approved',
    })) as any[];

    if (type === TournamentType.ROUND_ROBIN) {
      return this.generateRoundRobinGroups(
        tournamentId,
        `${category}_DOBLES`,
        fakeEnrollments,
        advancingPerGroup,
        {},
        minPlayersPerGroup,
      );
    }

    return this.generateElimination(
      tournamentId,
      `${category}_DOBLES`,
      fakeEnrollments,
    );
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
      64: MatchRound.R64,
      32: MatchRound.R32,
      16: MatchRound.R16,
      8: MatchRound.QF,
      4: MatchRound.SF,
      2: MatchRound.F,
    };
    return rounds[drawSize] || MatchRound.R32;
  }

  // Orden de slots ITF por tamaño de cuadro
  // S1 arriba, S2 abajo, S3/S4 en mitades opuestas, etc.
  private getITFSlotOrder(numPairs: number): number[] {
    const orders: Record<number, number[]> = {
      1: [0],
      2: [0, 1],
      4: [0, 3, 2, 1],
      8: [0, 7, 4, 3, 2, 5, 1, 6],
      16: [0, 15, 8, 7, 4, 11, 3, 12, 2, 9, 5, 14, 1, 10, 6, 13],
      32: [
        0, 31, 16, 15, 8, 23, 7, 24, 4, 19, 11, 28, 3, 20, 12, 27, 2, 17, 9,
        26, 5, 22, 14, 29, 1, 18, 10, 25, 6, 21, 13, 30,
      ],
    };
    return orders[numPairs] ?? Array.from({ length: numPairs }, (_, i) => i);
  }

  // Siembra ITF: S1 arriba del cuadro, S2 abajo; BYEs asignados a las mejores siembras.
  // Garantía: S1 y S2 solo se ven en la Final; S1-S4 solo se ven en Semis.
  private buildITFDraw(
    seeds: string[],
    byeCount: number,
    drawSize: number,
  ): string[] {
    const draw = new Array<string>(drawSize).fill('BYE');
    const numPairs = drawSize / 2;
    const slots = this.getITFSlotOrder(numPairs);

    const withBye = seeds.slice(0, byeCount);
    const toPlay = [...seeds.slice(byeCount)];

    const pairs: [string, string][] = [];
    withBye.forEach((s) => pairs.push([s, 'BYE']));
    while (toPlay.length >= 2) pairs.push([toPlay.shift()!, toPlay.pop()!]);
    if (toPlay.length === 1) pairs.push([toPlay[0], 'BYE']);

    pairs.forEach(([seed, partner], idx) => {
      if (idx >= slots.length) return;
      const slot = slots[idx];
      const evenPos = slot * 2;
      const oddPos = slot * 2 + 1;
      if (idx % 2 === 0) {
        draw[evenPos] = seed;
        draw[oddPos] = partner;
      } else {
        draw[oddPos] = seed;
        draw[evenPos] = partner;
      }
    });

    return draw;
  }

  private getSeedingForPlayer(
    playerId: string,
    enrollments: Enrollment[],
  ): number {
    if (!playerId || playerId === 'BYE') return null;
    return enrollments.find((e) => e.playerId === playerId)?.seeding || null;
  }

  // ── CREAR PLACEHOLDERS DE MAIN DRAW (para categorías ya generadas sin ellos) ──
  async createMainDrawPlaceholders(
    tournamentId: string,
    category: string,
    advancingCount: number,
  ) {
    const existing = await this.matchRepo.find({
      where: { tournamentId, category },
    });
    // Only block if subsequent rounds (QF/SF/F) already exist — R16/R32 may be the first elimination round
    const hasSubsequentRounds = existing.some((m) =>
      ['QF', 'SF', 'F'].includes(m.round as string),
    );
    if (hasSubsequentRounds) {
      return {
        created: 0,
        message: 'Los cuartos/semis/final ya existen para esta categoría',
      };
    }

    const ROUND_SEQ: Record<string, string> = {
      R32: 'R16',
      R16: 'QF',
      QF: 'SF',
      SF: 'F',
    };
    const drawSize = this.nextPowerOfTwo(advancingCount);
    const firstRound = this.getFirstRound(drawSize);
    let totalCreated = 0;

    // Check if firstRound already has matches (e.g. R16 created by draw but QF/SF/F missing)
    const existingFirstRound = existing.filter((m) => m.round === firstRound);
    let prevRound: any[];
    let curRound: string;

    if (existingFirstRound.length > 0) {
      // Reuse existing first-round matches, skip creating duplicates
      prevRound = existingFirstRound;
      curRound = firstRound as string;
    } else {
      prevRound = [];
      curRound = firstRound as string;
      for (let i = 0; i < drawSize / 2; i++) {
        prevRound.push(
          this.matchRepo.create({
            tournamentId,
            category,
            round: firstRound as any,
            player1Id: null,
            player2Id: null,
            status: MatchStatus.PENDING,
            bracketPosition: i,
          } as any),
        );
      }
      await this.matchRepo.save(prevRound);
      totalCreated += prevRound.length;
    }

    while (ROUND_SEQ[curRound]) {
      const nextRound = ROUND_SEQ[curRound];
      const nextMatches = [];
      for (let i = 0; i < prevRound.length; i += 2) {
        nextMatches.push(
          this.matchRepo.create({
            tournamentId,
            category,
            round: nextRound as any,
            player1Id: null,
            player2Id: null,
            status: MatchStatus.PENDING,
            bracketPosition: i / 2,
          } as any),
        );
      }
      await this.matchRepo.save(nextMatches);
      totalCreated += nextMatches.length;
      prevRound = nextMatches;
      curRound = nextRound;
    }

    return {
      created: totalCreated,
      message: `${totalCreated} partidos placeholder creados para ${category}`,
    };
  }
}
