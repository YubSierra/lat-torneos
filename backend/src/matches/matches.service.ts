import {
  Injectable,
  NotFoundException,
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
      select: ['id', 'nombres', 'apellidos', 'email'],
    });

    const userMap = new Map(
      users.map((u) => [
        u.id,
        `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
      ]),
    );

    return matches.map((m) => ({
      ...m,
      player1Name: userMap.get(m.player1Id) || 'BYE',
      player2Name: userMap.get(m.player2Id) || 'BYE',
      winnerName: userMap.get(m.winnerId) || null,
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
  // advancingPerGroup: cuántos jugadores pasan por grupo (1 o 2)
  async generateMainDrawFromRR(
    tournamentId: string,
    category: string,
    advancingPerGroup: number = 1,
  ) {
    const status = await this.getRRGroupStatus(tournamentId, category);

    const qualifiers: string[] = [];
    status.groups.forEach((group) => {
      group.standings
        .slice(0, advancingPerGroup)
        .forEach((p) => qualifiers.push(p.playerId));
    });

    if (qualifiers.length < 2) {
      throw new Error(
        `Solo hay ${qualifiers.length} clasificados. Mínimo 2 para generar Main Draw.`,
      );
    }

    const existingElim = await this.repo
      .createQueryBuilder('m')
      .where('m.tournamentId = :tid', { tid: tournamentId })
      .andWhere('m.category = :cat', { cat: category })
      .andWhere('m.round NOT IN (:...rrRounds)', {
        rrRounds: ['RR', 'RR_A', 'RR_B'],
      })
      .getMany();

    if (existingElim.length > 0) {
      throw new Error('El Main Draw ya fue generado para esta categoría');
    }

    // Calcular tamaño del cuadro
    const drawSize = this.nextPowerOfTwo(qualifiers.length);
    const byeCount = drawSize - qualifiers.length;
    const firstRound = this.getFirstRound(drawSize);

    // Llenar con BYEs
    const players = [...qualifiers];
    for (let i = 0; i < byeCount; i++) players.push('BYE');

    // Generar partidos
    const matches = [];
    for (let i = 0; i < drawSize; i += 2) {
      const p1 = players[i];
      const p2 = players[i + 1];

      if (p1 === 'BYE' || p2 === 'BYE') {
        const winner = p1 === 'BYE' ? p2 : p1;
        matches.push(
          this.repo.create({
            tournamentId,
            category,
            round: firstRound as any,
            player1Id: p1 === 'BYE' ? null : p1,
            player2Id: p2 === 'BYE' ? null : p2,
            winnerId: winner,
            status: MatchStatus.COMPLETED,
          }),
        );
      } else {
        matches.push(
          this.repo.create({
            tournamentId,
            category,
            round: firstRound as any,
            player1Id: p1,
            player2Id: p2,
            status: MatchStatus.PENDING,
          }),
        );
      }
    }

    await this.repo.save(matches);

    return {
      qualifiers: qualifiers.length,
      drawSize,
      byeCount,
      firstRound,
      matches: matches.length,
      groups: status.groups.map((g) => ({
        group: `Grupo ${g.groupLabel}`,
        classified: g.standings
          .slice(0, advancingPerGroup)
          .map((p) => p.playerName),
      })),
    };
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
        `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
      ]),
    );

    return {
      ...match,
      player1Name: userMap.get(match.player1Id) || 'Jugador 1',
      player2Name: userMap.get(match.player2Id) || 'Jugador 2',
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
    data: {
      scheduledAt: string;
      courtId?: string;
      estimatedDuration?: number;
      notes?: string;
    },
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

    const newDate = new Date(data.scheduledAt);
    const duration = data.estimatedDuration || match.estimatedDuration || 90;
    const dateStr = newDate.toISOString().split('T')[0];
    const newStart = this.timeToMinutes(newDate.toTimeString().slice(0, 5));
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
        (match.player1Id &&
          [other.player1Id, other.player2Id].includes(match.player1Id)) ||
        (match.player2Id &&
          [other.player1Id, other.player2Id].includes(match.player2Id));

      if (sharesPlayer && newStart < otherEnd && newEnd > otherStart) {
        const hora = new Date(other.scheduledAt).toTimeString().slice(0, 5);
        throw new HttpException(
          `⚠️ Conflicto de horario: un jugador de este partido ya tiene otro partido programado a las ${hora}. Elige un horario diferente.`,
          HttpStatus.CONFLICT,
        );
      }
    }

    match.scheduledAt = newDate;
    if (data.courtId) match.courtId = data.courtId;
    if (data.estimatedDuration) match.estimatedDuration = data.estimatedDuration;

    await this.repo.save(match);

    const enriched = await this.enrichWithNames([match]);
    return enriched[0];
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
}
