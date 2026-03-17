import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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
    const playerIds = [
      ...new Set(
        [
          ...matches.map((m) => m.player1Id),
          ...matches.map((m) => m.player2Id),
          ...matches.map((m) => m.winnerId),
        ].filter((id) => id && id !== 'BYE' && id.length === 36),
      ),
    ]; // ← filtrar BYE y nulls

    if (playerIds.length === 0) return matches;

    const users = await this.userRepo.find({
      where: { id: In(playerIds) },
      select: ['id', 'nombres', 'apellidos', 'email', 'photoUrl'],
    });

    const userMap = new Map(
      users.map((u) => [
        u.id,
        {
          name:
            `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
          photoUrl: (u as any).photoUrl || null,
        },
      ]),
    );

    const isBye = (m: Match) =>
      m.status === MatchStatus.COMPLETED || m.status === MatchStatus.WO;

    return matches.map((m) => ({
      ...m,
      player1Name: m.player1Id
        ? (userMap.get(m.player1Id)?.name || m.player1Id)
        : isBye(m) ? 'BYE' : null,
      player2Name: m.player2Id
        ? (userMap.get(m.player2Id)?.name || m.player2Id)
        : isBye(m) ? 'BYE' : null,
      winnerName: userMap.get(m.winnerId)?.name || null,
      player1PhotoUrl: userMap.get(m.player1Id)?.photoUrl || null,
      player2PhotoUrl: userMap.get(m.player2Id)?.photoUrl || null,
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
    match.sets1 = dto.sets1;
    match.sets2 = dto.sets2;
    match.games1 = dto.games1;
    match.games2 = dto.games2;
    match.points1 = dto.points1;
    match.points2 = dto.points2;

    if (dto.winnerId) {
      match.winnerId = dto.winnerId;
      match.status = MatchStatus.COMPLETED;
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
    const match = await this.findOne(id);
    match.winnerId = winnerId;
    match.status = MatchStatus.WO;
    match.sets1 = winnerId === match.player1Id ? 2 : 0;
    match.sets2 = winnerId === match.player2Id ? 2 : 0;
    match.games1 = winnerId === match.player1Id ? 12 : 0;
    match.games2 = winnerId === match.player2Id ? 12 : 0;
    await this.repo.save(match);
    await this.advanceWinner(match);
    return match;
  }

  // ── DECLARAR DOBLE W.O. ─────────────────────────
  // Ningún jugador se presentó — sin ganador, sin puntos, 0-0
  async declareDoubleWalkover(id: string) {
    const match    = await this.findOne(id);
    match.winnerId = null;
    match.status   = MatchStatus.WO;
    match.sets1    = 0;
    match.sets2    = 0;
    match.games1   = 0;
    match.games2   = 0;
    // NO se llama advanceWinner — nadie avanza
    await this.repo.save(match);
    return match;
  }

  // ── ESTADÍSTICAS DE JUGADOR ─────────────────────
  async getPlayerStats(playerId: string) {
    const asPlayer1 = await this.repo.find({ where: { player1Id: playerId } });
    const asPlayer2 = await this.repo.find({ where: { player2Id: playerId } });
    const all = [...asPlayer1, ...asPlayer2];

    const completed = all.filter((m) => m.status === MatchStatus.COMPLETED);
    const wins = completed.filter((m) => m.winnerId === playerId);

    return {
      playerId,
      totalMatches: completed.length,
      wins: wins.length,
      losses: completed.length - wins.length,
      winRate:
        completed.length > 0
          ? Math.round((wins.length / completed.length) * 100)
          : 0,
    };
  }

  // ── AVANCE AUTOMÁTICO AL SIGUIENTE PARTIDO ──────
  private async advanceWinner(completedMatch: Match) {
    if (!completedMatch.winnerId) return;

    // ── RR no avanza automáticamente ────────────────
    // El Main Draw se genera manualmente por el referee
    // cuando todos los partidos del grupo estén completos
    if (['RR', 'RR_A', 'RR_B'].includes(completedMatch.round)) return;

    const ROUND_PROGRESSION: Record<string, string> = {
      R64: 'R32',
      R32: 'R16',
      R16: 'QF',
      QF: 'SF',
      SF: 'F',
      RR: 'QF',
      RR_A: 'SF_M',
      RR_B: 'SF_M',
      SF_M: 'F_M',
    };

    const nextRound = ROUND_PROGRESSION[completedMatch.round];
    if (!nextRound) return;

    const { tournamentId, category } = completedMatch;

    const completedInRound = await this.repo.find({
      where: {
        tournamentId,
        category,
        round: completedMatch.round as any,
        status: MatchStatus.COMPLETED,
      },
      order: { createdAt: 'ASC' },
    });

    const completedWO = await this.repo.find({
      where: {
        tournamentId,
        category,
        round: completedMatch.round as any,
        status: MatchStatus.WO,
      },
      order: { createdAt: 'ASC' },
    });

    const allCompleted = [...completedInRound, ...completedWO].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const allInRound = await this.repo.find({
      where: { tournamentId, category, round: completedMatch.round as any },
    });

    if (!allInRound || allInRound.length === 0) return;

    const matchIndex = allInRound
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .findIndex((m) => m.id === completedMatch.id);

    if (matchIndex === -1) return;

    const pairIndex = Math.floor(matchIndex / 2);
    const pairOffset = matchIndex % 2;

    const sortedRound = allInRound.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const partner =
      sortedRound[pairOffset === 0 ? matchIndex + 1 : matchIndex - 1];

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
      const partnerCompleted =
        partner &&
        (partner.status === MatchStatus.COMPLETED ||
          partner.status === MatchStatus.WO);

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

    void allCompleted; // usado implícitamente en lógica anterior
  }

  // ── ELIMINAR PARTIDO ─────────────────────────────
  async removeMatch(id: string) {
    const match = await this.findOne(id);
    await this.repo.remove(match);
    return { message: 'Partido eliminado correctamente' };
  }

  // ── LIMPIAR PROGRAMACIÓN DEL DÍA ────────────────
  async clearScheduleByDate(tournamentId: string, date: string) {
    await this.repo
      .createQueryBuilder()
      .update()
      .set({ scheduledAt: null, courtId: null, estimatedDuration: 90 })
      .where('tournamentId = :tournamentId', { tournamentId })
      .andWhere('DATE(scheduledAt) = :date', { date })
      .execute();
    return { message: `Programación del ${date} eliminada` };
  }

  // ── ESTADO DEL RR POR GRUPO ─────────────────────
  async getRRGroupStatus(tournamentId: string, category: string) {
    const matches = await this.repo.find({
      where: { tournamentId, category, round: 'RR' as any },
      order: { createdAt: 'ASC' },
    });

    if (matches.length === 0) return { groups: [], allComplete: false };

    // Agrupar por groupLabel
    const byGroup = new Map<string, Match[]>();
    matches.forEach((m) => {
      const g = (m as any).groupLabel || 'A';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(m);
    });

    // Obtener nombres de jugadores
    const playerIds = [
      ...new Set(
        [
          ...matches.map((m) => m.player1Id),
          ...matches.map((m) => m.player2Id),
        ].filter(Boolean),
      ),
    ];

    const users =
      playerIds.length > 0
        ? await this.userRepo
            .createQueryBuilder('u')
            .where('u.id IN (:...ids)', { ids: playerIds })
            .getMany()
        : [];
    const userMap = new Map(
      users.map((u) => [
        u.id,
        `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
      ]),
    );

    const groups = [];

    byGroup.forEach((gMatches, groupLabel) => {
      const total = gMatches.length;
      const finished = gMatches.filter(
        (m) =>
          m.status === MatchStatus.COMPLETED || m.status === MatchStatus.WO,
      ).length;

      // Calcular standings
      const standings = new Map<
        string,
        { wins: number; losses: number; name: string }
      >();
      gMatches.forEach((m) => {
        if (!standings.has(m.player1Id)) {
          standings.set(m.player1Id, {
            wins: 0,
            losses: 0,
            name: userMap.get(m.player1Id) || m.player1Id,
          });
        }
        if (!standings.has(m.player2Id)) {
          standings.set(m.player2Id, {
            wins: 0,
            losses: 0,
            name: userMap.get(m.player2Id) || m.player2Id,
          });
        }
        if (m.winnerId) {
          standings.get(m.winnerId)!.wins++;
          const loserId =
            m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
          if (standings.has(loserId)) standings.get(loserId)!.losses++;
        }
      });

      const sorted = [...standings.entries()]
        .sort((a, b) => b[1].wins - a[1].wins)
        .map(([playerId, s], idx) => ({
          position: idx + 1,
          playerId,
          playerName: s.name,
          wins: s.wins,
          losses: s.losses,
        }));

      groups.push({
        groupLabel,
        total,
        finished,
        complete: finished === total,
        standings: sorted,
      });
    });

    const allComplete = groups.every((g) => g.complete);

    return { groups, allComplete };
  }

  // ── GENERAR MAIN DRAW DESDE RR ──────────────────
  async generateMainDrawFromRR(
    tournamentId: string,
    category: string,
    advancingPerGroup: number = 1,
  ) {
    const status = await this.getRRGroupStatus(tournamentId, category);
    if (!status.allComplete) {
      throw new Error('No todos los partidos del Round Robin están terminados');
    }

    // Clasificados: PRIMERO todos los 1ros (máxima prioridad de siembra = BYE),
    // LUEGO todos los 2dos. Así los primeros siempre tienen BYE antes que los segundos.
    const firstPlacers: string[] = [];
    const secondPlacers: string[] = [];
    status.groups.forEach(group => {
      if (group.standings[0]) firstPlacers.push(group.standings[0].playerId);
      if (advancingPerGroup >= 2 && group.standings[1]) secondPlacers.push(group.standings[1].playerId);
    });
    const qualifiers = [...firstPlacers, ...secondPlacers];

    if (qualifiers.length < 2)
      throw new Error('Se necesitan al menos 2 clasificados para generar el Main Draw');

    const existing = await this.repo.find({
      where: { tournamentId, category, round: 'QF' as any },
    });
    if (existing.length > 0)
      throw new Error('El Main Draw ya fue generado para esta categoría');

    const drawSize   = this.nextPowerOfTwo(qualifiers.length);
    const byeCount   = drawSize - qualifiers.length;
    const firstRound = this.getFirstRound(drawSize);

    // Construir el cuadro con siembra ITF
    const draw = this.buildITFDraw(qualifiers, byeCount, drawSize);

    const matches = [];
    for (let i = 0; i < drawSize; i += 2) {
      const p1 = draw[i];
      const p2 = draw[i + 1];
      if (p1 === 'BYE' || p2 === 'BYE') {
        const winner = p1 === 'BYE' ? p2 : p1;
        matches.push(this.repo.create({
          tournamentId, category, round: firstRound as any,
          player1Id: p1 === 'BYE' ? null : p1,
          player2Id: p2 === 'BYE' ? null : p2,
          winnerId: winner,
          status: MatchStatus.COMPLETED,
        }));
      } else {
        matches.push(this.repo.create({
          tournamentId, category, round: firstRound as any,
          player1Id: p1, player2Id: p2,
          status: MatchStatus.PENDING,
        }));
      }
    }

    await this.repo.save(matches);

    return {
      qualifiers: qualifiers.length,
      drawSize, byeCount, firstRound,
      matches: matches.length,
      groups: status.groups.map(g => ({
        group: `Grupo ${g.groupLabel}`,
        classified: g.standings.slice(0, advancingPerGroup).map(p => p.playerName),
      })),
    };
  }

  // ── SIEMBRA ITF ─────────────────────────────────────────────────────────────
  // Reglas:
  // 1. Los top `byeCount` seeds reciben BYE (prioridad a los 1ros de grupo)
  // 2. Los restantes se emparejan: el mejor disponible vs el peor disponible
  //    (S4 vs S_último, S5 vs S_penúltimo, etc.)
  // 3. Los pares se ubican en posiciones ITF:
  //    S1 arriba del cuadro, S2 abajo, S3/S4 en mitades opuestas, etc.
  //    Garantía: S1 y S2 solo se ven en la Final.
  //              S1-S4 solo se ven en Semis.
  private buildITFDraw(seeds: string[], byeCount: number, drawSize: number): string[] {
    const draw     = new Array<string>(drawSize).fill('BYE');
    const numPairs = drawSize / 2;
    const slots    = this.getITFSlotOrder(numPairs);

    // Construir los grupos (seed, pareja)
    const withBye = seeds.slice(0, byeCount);
    const toPlay  = [...seeds.slice(byeCount)];

    const pairs: [string, string][] = [];
    withBye.forEach(s => pairs.push([s, 'BYE']));
    // Emparejar: mejor vs peor de los que quedan
    while (toPlay.length >= 2) pairs.push([toPlay.shift()!, toPlay.pop()!]);
    if (toPlay.length === 1) pairs.push([toPlay[0], 'BYE']);

    pairs.forEach(([seed, partner], idx) => {
      if (idx >= slots.length) return;
      const slot    = slots[idx];
      const evenPos = slot * 2;
      const oddPos  = slot * 2 + 1;

      // Índice par  → seed en posición par del slot  (arriba del par)
      // Índice impar → seed en posición impar del slot (abajo del par)
      // Esto pone S1 en el top absoluto (pos 0) y S2 en el bottom absoluto (pos drawSize-1)
      if (idx % 2 === 0) {
        draw[evenPos] = seed;
        draw[oddPos]  = partner;
      } else {
        draw[oddPos]  = seed;
        draw[evenPos] = partner;
      }
    });

    return draw;
  }

  // Orden de slots ITF por tamaño de cuadro (garantiza la separación correcta entre siembras)
  private getITFSlotOrder(numPairs: number): number[] {
    const orders: Record<number, number[]> = {
      1:  [0],
      2:  [0, 1],
      4:  [0, 3, 2, 1],
      8:  [0, 7, 4, 3, 2, 5, 1, 6],
      16: [0, 15, 8, 7, 4, 11, 3, 12, 2, 9, 5, 14, 1, 10, 6, 13],
      32: [0, 31, 16, 15, 8, 23, 7, 24, 4, 19, 11, 28, 3, 20, 12, 27,
           2, 17, 9, 26, 5, 22, 14, 29, 1, 18, 10, 25, 6, 21, 13, 30],
    };
    return orders[numPairs] ?? Array.from({ length: numPairs }, (_, i) => i);
  }

  // ── ACTUALIZAR MARCADOR EN VIVO ─────────────────
  async updateLiveScore(dto: {
    matchId: string;
    sets: {
      games1: number;
      games2: number;
      tiebreak1?: number;
      tiebreak2?: number;
    }[];
    currentSet: number;
    currentGames1: number;
    currentGames2: number;
    currentPoints1: string;
    currentPoints2: string;
    winnerId?: string;
    status?: string;
  }) {
    const match = await this.findOne(dto.matchId);

    // Guardar historial de sets como JSON
    (match as any).setsHistory = JSON.stringify(dto.sets);
    (match as any).currentSet = dto.currentSet;
    match.games1 = dto.currentGames1;
    match.games2 = dto.currentGames2;
    match.points1 = dto.currentPoints1;
    match.points2 = dto.currentPoints2;

    // Calcular sets ganados
    let sets1 = 0,
      sets2 = 0;
    dto.sets.forEach((s) => {
      if (s.games1 > s.games2) sets1++;
      else if (s.games2 > s.games1) sets2++;
    });
    match.sets1 = sets1;
    match.sets2 = sets2;

    if (dto.winnerId) {
      match.winnerId = dto.winnerId;
      match.status = MatchStatus.COMPLETED;
      await this.advanceWinner(match);
    } else {
      match.status = MatchStatus.LIVE;
    }

    return this.repo.save(match);
  }

  // ── OBTENER PARTIDO CON FORMATO ─────────────────
  async getMatchWithFormat(matchId: string) {
    const match = await this.repo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Partido no encontrado');

    const playerIds = [match.player1Id, match.player2Id].filter(Boolean);
    const users =
      playerIds.length > 0
        ? await this.userRepo
            .createQueryBuilder('u')
            .where('u.id IN (:...ids)', { ids: playerIds })
            .getMany()
        : [];
    const userMap = new Map(
      users.map((u) => [
        u.id,
        {
          name:
            `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
          photoUrl: (u as any).photoUrl || null,
        },
      ]),
    );

    return {
      ...match,
      player1Name: userMap.get(match.player1Id)?.name || 'Jugador 1',
      player2Name: userMap.get(match.player2Id)?.name || 'Jugador 2',
      player1PhotoUrl: userMap.get(match.player1Id)?.photoUrl || null,
      player2PhotoUrl: userMap.get(match.player2Id)?.photoUrl || null,
      setsHistory: (match as any).setsHistory
        ? JSON.parse((match as any).setsHistory)
        : [],
    };
  }

  // ── QUITAR PARTIDO DE PROGRAMACIÓN ──────────────
  async unscheduleMatch(id: string) {
    const match = await this.findOne(id);

    if (
      match.status === MatchStatus.COMPLETED ||
      match.status === MatchStatus.WO
    ) {
      throw new Error('No se puede desprogramar un partido ya terminado');
    }

    match.scheduledAt = null;
    match.courtId = null;
    match.estimatedDuration = 90;
    match.status = MatchStatus.PENDING;

    await this.repo.save(match);
    return { message: 'Partido removido de la programación', matchId: id };
  }

  // ── REPROGRAMAR PARTIDO ─────────────────────────
  async rescheduleMatch(
    id: string,
    date: string,
    time: string,
    courtId: string,
    duration: number = 90,
  ) {
    const match = await this.findOne(id);

    if (
      match.status === MatchStatus.COMPLETED ||
      match.status === MatchStatus.WO
    ) {
      throw new HttpException(
        'No se puede reprogramar un partido ya terminado',
        HttpStatus.BAD_REQUEST,
      );
    }

    const newDate = new Date(`${date}T${time}:00`);
    const dateStr = newDate.toISOString().split('T')[0];
    const newStart = this.timeToMinutes(time);
    const newEnd = newStart + duration;

    const sameDayMatches = await this.repo
      .createQueryBuilder('m')
      .where('DATE(m.scheduledAt) = :date', { date: dateStr })
      .andWhere('m.id != :id', { id })
      .andWhere('m.status NOT IN (:...statuses)', {
        statuses: [MatchStatus.COMPLETED, MatchStatus.WO],
      })
      .getMany();

    for (const other of sameDayMatches) {
      if (!other.scheduledAt) continue;
      const otherStart = this.timeToMinutes(
        new Date(other.scheduledAt).toTimeString().slice(0, 5),
      );
      const otherEnd = otherStart + (other.estimatedDuration || 90);

      const sharesPlayer =
        (match.player1Id && [other.player1Id, other.player2Id].includes(match.player1Id)) ||
        (match.player2Id && [other.player1Id, other.player2Id].includes(match.player2Id));

      if (sharesPlayer && newStart < otherEnd && newEnd > otherStart) {
        const hora = new Date(other.scheduledAt).toTimeString().slice(0, 5);
        throw new HttpException(
          `⚠️ Conflicto de horario: un jugador ya tiene otro partido a las ${hora}. Elige un horario diferente.`,
          HttpStatus.CONFLICT,
        );
      }
    }

    match.scheduledAt = newDate;
    match.courtId = courtId;
    match.estimatedDuration = duration;
    await this.repo.save(match);
    return { message: 'Partido reprogramado correctamente', match };
  }

  // ── SUSPENDER PARTIDO INDIVIDUAL ────────────────
  async suspendMatch(id: string, reason: string, resumeScheduledAt?: string) {
    const match = await this.findOne(id);
    if (
      match.status === MatchStatus.COMPLETED ||
      match.status === MatchStatus.WO
    ) {
      throw new Error('No se puede suspender un partido ya terminado');
    }
    match.status = MatchStatus.SUSPENDED;
    (match as any).suspensionReason = reason;
    if (resumeScheduledAt) match.scheduledAt = new Date(resumeScheduledAt);
    return this.repo.save(match);
  }

  // ── REANUDAR PARTIDO SUSPENDIDO ──────────────────
  async resumeMatch(id: string, newScheduledAt?: string) {
    const match = await this.findOne(id);
    if (match.status !== MatchStatus.SUSPENDED) {
      throw new Error('El partido no está suspendido');
    }
    match.status = MatchStatus.PENDING;
    if (newScheduledAt) {
      match.scheduledAt = new Date(newScheduledAt);
    } else {
      match.scheduledAt = null;
    }
    return this.repo.save(match);
  }

  // ── SUSPENDER TODA UNA JORNADA ───────────────────
  async suspendTournamentDay(
    tournamentId: string,
    date: string,
    reason: string,
    resumeScheduledAt?: string,
  ) {
    const matches = await this.repo
      .createQueryBuilder('m')
      .where('m.tournamentId = :tournamentId', { tournamentId })
      .andWhere('DATE(m.scheduledAt) = :date', { date })
      .andWhere('m.status NOT IN (:...done)', {
        done: [MatchStatus.COMPLETED, MatchStatus.WO],
      })
      .getMany();

    if (matches.length === 0) {
      throw new Error(`No hay partidos programados para el ${date}`);
    }

    for (const m of matches) {
      m.status = MatchStatus.SUSPENDED;
      (m as any).suspensionReason = reason;
      if (resumeScheduledAt) m.scheduledAt = new Date(resumeScheduledAt);
    }

    await this.repo.save(matches);
    return { suspended: matches.length, date, reason };
  }

  // ── REANUDAR TODA UNA JORNADA ────────────────────
  async resumeTournamentDay(tournamentId: string, date: string) {
    const matches = await this.repo
      .createQueryBuilder('m')
      .where('m.tournamentId = :tournamentId', { tournamentId })
      .andWhere('m.status = :status', { status: MatchStatus.SUSPENDED })
      .andWhere('DATE(m.scheduledAt) = :date', { date })
      .getMany();

    if (matches.length === 0) {
      throw new Error(`No hay partidos suspendidos para el ${date}`);
    }

    for (const m of matches) {
      m.status = MatchStatus.PENDING;
      m.scheduledAt = null;
    }

    await this.repo.save(matches);
    return { resumed: matches.length, date };
  }

  // ── LISTAR PARTIDOS SUSPENDIDOS ──────────────────
  async getSuspendedMatches(tournamentId: string) {
    const matches = await this.repo.find({
      where: { tournamentId, status: MatchStatus.SUSPENDED },
      order: { scheduledAt: 'ASC' },
    });
    return this.enrichWithNames(matches);
  }

  // ── RONDAS PENDIENTES ────────────────────────────
  async getPendingRounds(tournamentId: string) {
    const matches = await this.repo
      .createQueryBuilder('m')
      .select('DISTINCT m.round', 'round')
      .where('m.tournamentId = :tournamentId', { tournamentId })
      .andWhere('m.status IN (:...statuses)', {
        statuses: [MatchStatus.PENDING, MatchStatus.SUSPENDED],
      })
      .getRawMany();

    return matches.map((r) => r.round);
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  private getFirstRound(drawSize: number): string {
    const r: Record<number, string> = {
      64: 'R64',
      32: 'R32',
      16: 'R16',
      8: 'QF',
      4: 'SF',
      2: 'F',
    };
    return r[drawSize] || 'R16';
  }

  // ── LISTAR BYEs DEL CUADRO ─────────────────────────────────────────
  async getByesForCategory(tournamentId: string, category: string) {
    const byeMatches = await this.repo
      .createQueryBuilder('m')
      .where('m.tournamentId = :tid', { tid: tournamentId })
      .andWhere('m.category = :cat', { cat: category })
      .andWhere('m.round != :rr1 AND m.round != :rr2 AND m.round != :rr3', {
        rr1: 'RR',
        rr2: 'RR_A',
        rr3: 'RR_B',
      })
      .andWhere('(m.player1Id IS NULL OR m.player2Id IS NULL)')
      .andWhere('m.scheduledAt IS NULL')
      .getMany();

    return this.enrichWithNames(byeMatches);
  }

  // ── LISTAR PARTIDOS PENDIENTES DE UN JUGADOR ────────────────────────
  async getPendingMatchesForPlayer(
    tournamentId: string,
    category: string,
    playerId: string,
  ) {
    const matches = await this.repo.find({
      where: [
        {
          tournamentId,
          category,
          player1Id: playerId,
          status: MatchStatus.PENDING,
        },
        {
          tournamentId,
          category,
          player2Id: playerId,
          status: MatchStatus.PENDING,
        },
      ],
    });
    return this.enrichWithNames(matches);
  }

  // ── ASIGNAR ALTERNO A BYE ───────────────────────────────────────────
  async assignAlternateToBye(dto: {
    matchId: string;
    alternatePlayerId: string;
    tournamentId: string;
    category: string;
  }) {
    const match = await this.findOne(dto.matchId);

    if (match.player1Id !== null && match.player2Id !== null) {
      throw new Error('Este partido no tiene un slot de BYE disponible');
    }
    if (match.scheduledAt) {
      throw new Error('El partido ya está programado. No se puede asignar alterno.');
    }

    const alreadyIn = await this.repo.findOne({
      where: [
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player1Id: dto.alternatePlayerId,
          status: MatchStatus.PENDING,
        },
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player2Id: dto.alternatePlayerId,
          status: MatchStatus.PENDING,
        },
      ],
    });
    if (alreadyIn) {
      throw new Error('Este jugador ya tiene partidos asignados en esta categoría');
    }

    if (match.player1Id === null) {
      match.player1Id = dto.alternatePlayerId;
    } else {
      match.player2Id = dto.alternatePlayerId;
    }

    match.status = MatchStatus.PENDING;
    match.winnerId = null;

    await this.ensureAlternateEnrollment(
      dto.tournamentId,
      dto.category,
      dto.alternatePlayerId,
      'bye_replacement',
    );

    const saved = await this.repo.save(match);
    return this.enrichWithNames([saved]).then((r) => r[0]);
  }

  // ── REEMPLAZAR JUGADOR RETIRADO ─────────────────────────────────────
  async replaceRetiredPlayer(dto: {
    tournamentId: string;
    category: string;
    retiredPlayerId: string;
    alternatePlayerId: string;
  }) {
    const pendingMatches = await this.repo.find({
      where: [
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player1Id: dto.retiredPlayerId,
          status: MatchStatus.PENDING,
        },
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player2Id: dto.retiredPlayerId,
          status: MatchStatus.PENDING,
        },
      ],
    });

    if (pendingMatches.length === 0) {
      throw new Error(
        'Este jugador no tiene partidos pendientes. ' +
          'Si ya jugó algún partido, no es posible reemplazarlo.',
      );
    }

    const liveOrScheduled = await this.repo.findOne({
      where: [
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player1Id: dto.retiredPlayerId,
          status: MatchStatus.LIVE,
        },
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player2Id: dto.retiredPlayerId,
          status: MatchStatus.LIVE,
        },
      ],
    });
    if (liveOrScheduled) {
      throw new Error('El jugador tiene un partido en vivo. No se puede reemplazar.');
    }

    const alternateHasMatches = await this.repo.findOne({
      where: [
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player1Id: dto.alternatePlayerId,
          status: MatchStatus.PENDING,
        },
        {
          tournamentId: dto.tournamentId,
          category: dto.category,
          player2Id: dto.alternatePlayerId,
          status: MatchStatus.PENDING,
        },
      ],
    });
    if (alternateHasMatches) {
      throw new Error('El jugador alterno ya tiene partidos en esta categoría');
    }

    for (const match of pendingMatches) {
      if (match.player1Id === dto.retiredPlayerId) {
        match.player1Id = dto.alternatePlayerId;
      } else {
        match.player2Id = dto.alternatePlayerId;
      }
    }

    await this.repo.save(pendingMatches);

    await this.markPlayerRetired(
      dto.tournamentId,
      dto.category,
      dto.retiredPlayerId,
    );
    await this.ensureAlternateEnrollment(
      dto.tournamentId,
      dto.category,
      dto.alternatePlayerId,
      'retirement_replacement',
    );

    return {
      message: `Jugador reemplazado en ${pendingMatches.length} partido(s)`,
      matchesUpdated: pendingMatches.length,
    };
  }

  // ── HELPERS PRIVADOS ───────────────────────────────────────────────

  private async ensureAlternateEnrollment(
    tournamentId: string,
    category: string,
    playerId: string,
    reason: string,
  ) {
    const enrollmentRepo = this.repo.manager.getRepository('enrollments');
    const existing = await enrollmentRepo.findOne({
      where: { tournamentId, playerId, category },
    });

    if (existing) {
      if (existing.status === 'alternate') {
        existing.status = 'approved';
        await enrollmentRepo.save(existing);
      }
      return existing;
    }

    return enrollmentRepo.save(
      enrollmentRepo.create({
        tournamentId,
        playerId,
        category,
        modality: 'singles',
        status: 'approved',
        paymentId: `ALTERNO_${reason.toUpperCase()}`,
      }),
    );
  }

  private async markPlayerRetired(
    tournamentId: string,
    category: string,
    playerId: string,
  ) {
    const enrollmentRepo = this.repo.manager.getRepository('enrollments');
    const enrollment = await enrollmentRepo.findOne({
      where: { tournamentId, playerId, category },
    });
    if (enrollment) {
      enrollment.status = 'alternate';
      await enrollmentRepo.save(enrollment);
    }
  }

  // ── ASIGNAR PARTIDO A SLOT ──────────────────────────────────────────────────
  async assignToSlot(
    matchId: string,
    slot: {
      courtId: string;
      scheduledDate: string;
      scheduledTime: string;
      estimatedDuration: number;
    },
  ) {
    const match = await this.repo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Partido no encontrado');

    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(
        `Solo se pueden reasignar partidos en estado PENDING. Estado actual: ${match.status}`,
      );
    }

    const scheduledAt = new Date(`${slot.scheduledDate}T${slot.scheduledTime}:00`);

    match.courtId = slot.courtId;
    match.scheduledAt = scheduledAt;
    match.estimatedDuration = slot.estimatedDuration;

    await this.repo.save(match);

    return {
      success: true,
      matchId: match.id,
      courtId: match.courtId,
      scheduled: scheduledAt.toISOString(),
      message: 'Partido asignado al slot correctamente',
    };
  }

  // ── PARTIDOS PENDIENTES SIN PROGRAMAR ─────────────────────────────────────
  async getUnscheduled(tournamentId: string) {
    const matches = await this.repo.find({
      where: { tournamentId, status: MatchStatus.PENDING },
      order: { category: 'ASC', round: 'ASC' },
    });

    const unscheduled = matches.filter((m) => !m.courtId || !m.scheduledAt);

    const playerIds = [
      ...new Set(
        [
          ...unscheduled.map((m) => m.player1Id),
          ...unscheduled.map((m) => m.player2Id),
        ].filter(Boolean),
      ),
    ];

    const players =
      playerIds.length > 0
        ? await this.repo.manager.getRepository('users').find({
            where: { id: In(playerIds) },
          })
        : [];

    const playerMap = new Map(
      players.map((p: any) => [p.id, `${p.nombres} ${p.apellidos}`]),
    );

    return unscheduled.map((m) => ({
      id: m.id,
      category: m.category,
      round: m.round,
      groupLabel: (m as any).groupLabel || null,
      player1: m.player1Id ? playerMap.get(m.player1Id) || m.player1Id : 'BYE',
      player2: m.player2Id ? playerMap.get(m.player2Id) || m.player2Id : 'BYE',
      player1Id: m.player1Id,
      player2Id: m.player2Id,
    }));
  }

  // ── CATEGORÍAS ACTIVAS DEL TORNEO ─────────────────────────────────────────
  async getCategoriesByTournament(tournamentId: string): Promise<string[]> {
    const result = await this.repo
      .createQueryBuilder('m')
      .select('DISTINCT m.category', 'category')
      .where('m.tournamentId = :tournamentId', { tournamentId })
      .orderBy('m.category', 'ASC')
      .getRawMany();
    return result.map((r) => r.category);
  }

  // ── PARTIDOS PENDIENTES SIN PROGRAMAR ────────────────────────────────────
  async getPendingUnscheduled(tournamentId: string) {
    // Traer todos los pendientes del torneo
    const all = await this.repo.find({
      where: { tournamentId, status: MatchStatus.PENDING },
    });

    // Filtrar los que NO tienen scheduledAt
    const unscheduled = all.filter((m) => !(m as any).scheduledAt);

    if (unscheduled.length === 0) return [];

    // Enriquecer con nombres de jugadores
    const playerIds = [
      ...new Set(
        [
          ...unscheduled.map((m) => m.player1Id),
          ...unscheduled.map((m) => m.player2Id),
        ].filter(Boolean),
      ),
    ];

    const users =
      playerIds.length > 0
        ? await this.userRepo
            .createQueryBuilder('u')
            .where('u.id IN (:...ids)', { ids: playerIds })
            .getMany()
        : [];

    const userMap = new Map(
      users.map((u) => [
        u.id,
        `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
      ]),
    );

    return unscheduled.map((m) => ({
      ...m,
      player1Name: m.player1Id ? (userMap.get(m.player1Id) || 'Jugador') : 'BYE',
      player2Name: m.player2Id ? (userMap.get(m.player2Id) || 'Jugador') : 'BYE',
    }));
  }

  // ── RESUMEN DEL CUADRO POR CATEGORÍA ─────────────────────────────────────
  async getDrawSummary(tournamentId: string, category: string) {
    const all = await this.repo.find({ where: { tournamentId, category } });
    const RR = ['RR', 'RR_A', 'RR_B'];
    const MAIN = ['R64', 'R32', 'R16', 'QF', 'SF', 'F', 'SF_M', 'F_M'];
    const rr = all.filter((m) => RR.includes(m.round as string));
    const main = all.filter((m) => MAIN.includes(m.round as string));
    return {
      hasRR: rr.length > 0,
      hasMainDraw: main.length > 0,
      rrCount: rr.length,
      mainCount: main.length,
      rrCompleted: rr.filter((m) =>
        [MatchStatus.COMPLETED, MatchStatus.WO].includes(m.status),
      ).length,
      mainCompleted: main.filter((m) =>
        [MatchStatus.COMPLETED, MatchStatus.WO].includes(m.status),
      ).length,
    };
  }

  // ── ELIMINAR CUADRO ───────────────────────────────────────────────────────
  async deleteDraw(
    tournamentId: string,
    category: string,
    drawType: 'rr' | 'maindraw' | 'all',
  ) {
    const RR_ROUNDS = ['RR', 'RR_A', 'RR_B'];
    const MAIN_ROUNDS = ['R64', 'R32', 'R16', 'QF', 'SF', 'F', 'SF_M', 'F_M'];
    const rounds =
      drawType === 'rr'
        ? RR_ROUNDS
        : drawType === 'maindraw'
          ? MAIN_ROUNDS
          : [...RR_ROUNDS, ...MAIN_ROUNDS];

    const all = await this.repo.find({ where: { tournamentId, category } });
    const toDelete = all.filter((m) => rounds.includes(m.round as string));

    if (toDelete.length === 0) {
      throw new Error('No hay partidos para eliminar en esa selección');
    }

    await this.repo.remove(toDelete);
    return {
      deleted: toDelete.length,
      message: `Se eliminaron ${toDelete.length} partidos (${category})`,
    };
  }
}
