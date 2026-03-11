import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Match, MatchStatus } from '../matches/match.entity';
import { Court } from '../courts/court.entity';
import { CourtSchedule } from '../courts/court-schedule.entity';
import { User } from '../users/user.entity';

interface CourtBlock {
  start: string;
  end: string;
}
interface CourtAvailability {
  courtId: string;
  blocks: CourtBlock[];
}
interface RoundDurations {
  R64?: number;
  R32?: number;
  R16?: number;
  QF?: number;
  SF?: number;
  F?: number;
  RR?: number;
  RR_A?: number;
  RR_B?: number;
  SF_M?: number;
  F_M?: number;
}

interface Slot {
  courtId: string;
  courtName: string;
  sede: string;
  time: string;
  endTime: string;
  duration: number;
}

// Orden de partidos RR según reglas LAT
// Grupo de 3: 2v3, 1v3, 1v2
// Grupo de 4: 3v4, 2v4, 2v3, 1v4, 1v3, 1v2
const RR_ORDER_3 = [
  [1, 2],
  [0, 2],
  [0, 1],
]; // índices base 0
const RR_ORDER_4 = [
  [2, 3],
  [1, 3],
  [1, 2],
  [0, 3],
  [0, 2],
  [0, 1],
];

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(Match)
    private matchRepo: Repository<Match>,
    @InjectRepository(Court)
    private courtRepo: Repository<Court>,
    @InjectRepository(CourtSchedule)
    private scheduleRepo: Repository<CourtSchedule>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // ── GENERAR PROGRAMACIÓN ────────────────────────
  async generateSchedule(
    tournamentId: string,
    date: string,
    courtsAvailability: CourtAvailability[],
    roundDurations: RoundDurations,
    maxMatchesPerPlayer: number = 2,
    categories?: string[],
    roundFilter?: string[],
    includeSuspended: boolean = true,
    save: boolean = true,
  ) {
    if (!courtsAvailability?.length) {
      throw new Error('Debes seleccionar al menos una cancha con horario disponible');
    }

    // 1. Obtener partidos pendientes (y suspendidos si aplica)
    const statusFilter = includeSuspended
      ? [MatchStatus.PENDING, MatchStatus.SUSPENDED]
      : [MatchStatus.PENDING];

    let matches = await this.matchRepo
      .createQueryBuilder('match')
      .where('match.tournamentId = :tournamentId', { tournamentId })
      .andWhere('match.status IN (:...statuses)', { statuses: statusFilter })
      .orderBy('match.createdAt', 'ASC')
      .getMany();

    // Filtrar por ronda si se especificó
    if (roundFilter && roundFilter.length > 0) {
      matches = matches.filter((m) => roundFilter.includes(m.round));
    }

    // 1b. Filtrar por categorías seleccionadas
    if (categories && categories.length > 0) {
      matches = matches.filter((m) => categories.includes(m.category));
      if (matches.length === 0) {
        throw new Error(
          `No hay partidos pendientes para las categorias: ${categories.join(', ')}`,
        );
      }
    }

    if (matches.length === 0) {
      throw new Error('No hay partidos pendientes para programar');
    }

    // 2. Ordenar partidos RR por grupo respetando el orden LAT
    matches = this.sortMatchesByRROrder(matches);

    // 3. Obtener canchas
    const courtIds = courtsAvailability.map((c) => c.courtId);
    const courts = await this.courtRepo.find({ where: { id: In(courtIds) } });
    const courtMap = new Map(courts.map((c) => [c.id, c]));

    // 4. Construir slots
    const slots = this.buildSlotsFromBlocks(courtsAvailability, courtMap, date, roundDurations);
    if (slots.length === 0) {
      throw new Error('No hay slots disponibles con los horarios indicados');
    }

    // 5. Obtener partidos ya programados ese día (para validar conflictos)
    const existingScheduled = await this.matchRepo
      .createQueryBuilder('m')
      .where('m.tournamentId = :tid', { tid: tournamentId })
      .andWhere('DATE(m.scheduledAt) = :date', { date })
      .andWhere('m.status != :s', { s: MatchStatus.PENDING })
      .getMany();

    // 6. Obtener parejas de dobles para validar conflictos singles+dobles
    const doublesTeams = (await this.matchRepo.manager
      .getRepository('doubles_teams')
      .find({ where: { tournamentId } })) as any[];

    // Mapa: playerId → [teamId, teamId...] (para saber si juega dobles)
    const playerDoublesMap = new Map<string, string[]>();
    doublesTeams.forEach((t: any) => {
      if (t.player1Id) {
        if (!playerDoublesMap.has(t.player1Id)) playerDoublesMap.set(t.player1Id, []);
        playerDoublesMap.get(t.player1Id)!.push(t.id);
      }
      if (t.player2Id) {
        if (!playerDoublesMap.has(t.player2Id)) playerDoublesMap.set(t.player2Id, []);
        playerDoublesMap.get(t.player2Id)!.push(t.id);
      }
    });

    // 7. Verificar sede única para singles+dobles misma categoría mismo día
    this.validateSameSedeSinglesDoubles(matches, courtsAvailability, courtMap, date, tournamentId);

    // 8. Asignar partidos a slots con todas las validaciones
    const assignments = [];
    const playerMatchCount = new Map<string, number>(); // playerId → count ese día
    const playerScheduled = new Map<string, { start: number; end: number }[]>(); // playerId → slots ocupados
    const usedSlotsByCourt = new Map<string, Set<number>>(); // courtId → slots usados

    // Inicializar contadores con partidos ya existentes
    existingScheduled.forEach((m) => {
      if (m.scheduledAt) {
        const timeStr = m.scheduledAt.toTimeString().slice(0, 5);
        const start = this.timeToMinutes(timeStr);
        const end = start + (m.estimatedDuration || 90);
        [m.player1Id, m.player2Id].filter(Boolean).forEach((pid) => {
          const cnt = playerMatchCount.get(pid) || 0;
          playerMatchCount.set(pid, cnt + 1);
          if (!playerScheduled.has(pid)) playerScheduled.set(pid, []);
          playerScheduled.get(pid)!.push({ start, end });
        });
      }
    });

    for (const match of matches) {
      const duration = roundDurations[match.round] || 90;
      const p1 = match.player1Id;
      const p2 = match.player2Id;

      // Buscar slot válido
      let assigned = false;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const courtSlots = usedSlotsByCourt.get(slot.courtId) || new Set<number>();
        if (courtSlots.has(i)) continue;
        if (slot.duration < duration) continue;

        const slotStart = this.timeToMinutes(slot.time);
        const slotEnd = slotStart + duration;

        // ── VALIDACIÓN 1: máx partidos por jugador (RR no aplica — juega todos) ──
        const isRR = ['RR', 'RR_A', 'RR_B'].includes(match.round);
        if (!isRR) {
          if (p1 && (playerMatchCount.get(p1) || 0) >= maxMatchesPerPlayer)
            continue;
          if (p2 && (playerMatchCount.get(p2) || 0) >= maxMatchesPerPlayer)
            continue;
        }

        // ── VALIDACIÓN 2: no mismo horario en dos canchas ──
        if (p1 && this.hasTimeConflict(playerScheduled.get(p1) || [], slotStart, slotEnd)) continue;
        if (p2 && this.hasTimeConflict(playerScheduled.get(p2) || [], slotStart, slotEnd)) continue;

        // ── VALIDACIÓN 3: no singles y dobles al mismo tiempo ──
        if (p1 && this.hasDoublesConflict(p1, slotStart, slotEnd, playerScheduled, playerDoublesMap, match))
          continue;
        if (p2 && this.hasDoublesConflict(p2, slotStart, slotEnd, playerScheduled, playerDoublesMap, match))
          continue;

        // ── VALIDACIÓN 4: singles y dobles misma categoría → misma sede ──
        const court = courtMap.get(slot.courtId);
        if (court && !this.validateCategorySede(match, court, assignments)) continue;

        // ✅ Slot válido — asignar (save se hace en batch al final)

        // Actualizar contadores
        [p1, p2].filter(Boolean).forEach((pid) => {
          playerMatchCount.set(pid!, (playerMatchCount.get(pid!) || 0) + 1);
          if (!playerScheduled.has(pid!)) playerScheduled.set(pid!, []);
          playerScheduled.get(pid!)!.push({ start: slotStart, end: slotEnd });
        });

        if (!usedSlotsByCourt.has(slot.courtId)) usedSlotsByCourt.set(slot.courtId, new Set());
        usedSlotsByCourt.get(slot.courtId)!.add(i);

        // Obtener nombres
        const [player1, player2] = await Promise.all([
          p1 ? this.userRepo.findOne({ where: { id: p1 } }) : null,
          p2 ? this.userRepo.findOne({ where: { id: p2 } }) : null,
        ]);

        assignments.push({
          matchId: match.id,
          courtId: slot.courtId,
          sede: slot.sede,
          court: slot.courtName,
          date,
          time: slot.time,
          duration: `${duration} min`,
          round: match.round,
          category: match.category,
          groupLabel: (match as any).groupLabel || null,
          player1: player1 ? `${player1.nombres} ${player1.apellidos}` : 'BYE',
          player2: player2 ? `${player2.nombres} ${player2.apellidos}` : 'BYE',
        });

        assigned = true;
        break;
      }

      if (!assigned) {
        assignments.push({
          matchId: match.id,
          sede: '—',
          court: '—',
          date,
          time: '—',
          duration: `${duration} min`,
          round: match.round,
          category: match.category,
          player1: '—',
          player2: '—',
          warning: 'No se pudo programar: conflicto de horario o límite de partidos alcanzado',
        });
      }
    }

    const scheduled = assignments.filter((a) => a.time !== '—');
    const skipped = assignments.filter((a) => a.time === '—');

    // Solo persistir en BD si save = true (confirm, no preview)
    if (save) {
      for (const a of scheduled) {
        await this.matchRepo.update(a.matchId, {
          scheduledAt: new Date(`${date}T${a.time}:00`),
          courtId: a.courtId,
          estimatedDuration: parseInt(a.duration),
          status: MatchStatus.PENDING,
        });
      }
    }

    return {
      date,
      isPreview: !save,
      courtsUsed: courts.length,
      matchesScheduled: scheduled.length,
      matchesPending: skipped.length,
      skippedReasons: skipped.map((a) => `${a.category} ${a.round}: ${a.warning}`),
      schedule: scheduled,
    };
  }

  // ── ORDENAR PARTIDOS RR SEGÚN ORDEN LAT ─────────
  private sortMatchesByRROrder(matches: Match[]): Match[] {
    const rrMatches = matches.filter((m) => ['RR', 'RR_A', 'RR_B'].includes(m.round));
    const otherMatches = matches.filter((m) => !['RR', 'RR_A', 'RR_B'].includes(m.round));

    if (rrMatches.length === 0) return matches;

    // Agrupar por grupo (groupLabel + category)
    const byGroup = new Map<string, Match[]>();
    rrMatches.forEach((m) => {
      const key = `${m.category}_${(m as any).groupLabel || 'A'}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(m);
    });

    const ordered: Match[] = [];

    byGroup.forEach((groupMatches) => {
      const n = this.getGroupSize(groupMatches);

      if (n === 3) {
        const players = this.getUniquePlayers(groupMatches);
        RR_ORDER_3.forEach(([i, j]) => {
          const m = groupMatches.find(
            (m) =>
              (m.player1Id === players[i] && m.player2Id === players[j]) ||
              (m.player1Id === players[j] && m.player2Id === players[i]),
          );
          if (m) ordered.push(m);
        });
      } else if (n === 4) {
        const players = this.getUniquePlayers(groupMatches);
        RR_ORDER_4.forEach(([i, j]) => {
          const m = groupMatches.find(
            (m) =>
              (m.player1Id === players[i] && m.player2Id === players[j]) ||
              (m.player1Id === players[j] && m.player2Id === players[i]),
          );
          if (m) ordered.push(m);
        });
      } else {
        // Fallback: orden original
        ordered.push(...groupMatches);
      }
    });

    return [...ordered, ...otherMatches];
  }

  private getGroupSize(matches: Match[]): number {
    return this.getUniquePlayers(matches).length;
  }

  private getUniquePlayers(matches: Match[]): string[] {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.player1Id) set.add(m.player1Id);
      if (m.player2Id) set.add(m.player2Id);
    });
    return [...set];
  }

  // ── VALIDAR CONFLICTO DE HORARIO ────────────────
  private hasTimeConflict(
    existing: { start: number; end: number }[],
    newStart: number,
    newEnd: number,
  ): boolean {
    return existing.some((e) => newStart < e.end && newEnd > e.start);
  }

  // ── VALIDAR CONFLICTO SINGLES + DOBLES ──────────
  private hasDoublesConflict(
    playerId: string,
    slotStart: number,
    slotEnd: number,
    playerScheduled: Map<string, { start: number; end: number }[]>,
    playerDoublesMap: Map<string, string[]>,
    currentMatch: Match,
  ): boolean {
    const isDoubles = currentMatch.category.endsWith('_DOBLES');
    const teamIds = playerDoublesMap.get(playerId) || [];
    if (teamIds.length === 0) return false;

    const scheduled = playerScheduled.get(playerId) || [];
    return scheduled.some((s) => slotStart < s.end && slotEnd > s.start);
  }

  // ── VALIDAR SEDE ÚNICA SINGLES+DOBLES ───────────
  private validateCategorySede(match: Match, court: Court, assignments: any[]): boolean {
    const baseCategory = match.category.replace('_DOBLES', '');

    const sameCategory = assignments.filter(
      (a) =>
        a.category === baseCategory || a.category === `${baseCategory}_DOBLES`,
    );

    if (sameCategory.length === 0) return true;

    const existingSede = sameCategory[0].sede;
    const thisSede = court.sede || 'Principal'; // normalizar igual que slot.sede
    return thisSede === existingSede || !existingSede || existingSede === '—';
  }

  private validateSameSedeSinglesDoubles(
    matches: Match[],
    courtsAvailability: CourtAvailability[],
    courtMap: Map<string, Court>,
    date: string,
    tournamentId: string,
  ) {
    // Esta validación se hace en tiempo real durante la asignación
  }

  // ── CONSTRUIR SLOTS DESDE BLOQUES ───────────────
  private buildSlotsFromBlocks(
    courtsAvailability: CourtAvailability[],
    courtMap: Map<string, Court>,
    date: string,
    roundDurations: RoundDurations,
  ): Slot[] {
    const slots: Slot[] = [];
    const minDuration =
      Math.min(...(Object.values(roundDurations).filter(Boolean) as number[])) || 75;

    for (const courtAvail of courtsAvailability) {
      const court = courtMap.get(courtAvail.courtId);
      if (!court) continue;

      for (const block of courtAvail.blocks) {
        const startMinutes = this.timeToMinutes(block.start);
        const endMinutes = this.timeToMinutes(block.end);
        let current = startMinutes;

        while (current + minDuration <= endMinutes) {
          const remaining = endMinutes - current;
          slots.push({
            courtId: court.id,
            courtName: court.name,
            sede: court.sede || 'Principal',
            time: this.minutesToTime(current),
            endTime: this.minutesToTime(current + minDuration),
            duration: remaining,
          });
          current += minDuration;
        }
      }
    }

    return slots.sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ── VER PROGRAMACIÓN DE UN TORNEO ──────────────
  async getSchedule(tournamentId: string) {
    const matches = await this.matchRepo.find({
      where: { tournamentId },
      order: { scheduledAt: 'ASC' },
    });

    const playerIds = [
      ...new Set(
        [...matches.map((m) => m.player1Id), ...matches.map((m) => m.player2Id)].filter(Boolean),
      ),
    ];

    const players =
      playerIds.length > 0
        ? await this.userRepo.find({ where: { id: In(playerIds) } })
        : [];
    const playerMap = new Map(players.map((p) => [p.id, `${p.nombres} ${p.apellidos}`]));

    const courtIds = [...new Set(matches.map((m) => m.courtId).filter(Boolean))];
    const courts =
      courtIds.length > 0
        ? await this.courtRepo.find({ where: { id: In(courtIds) } })
        : [];
    const courtMap = new Map(courts.map((c) => [c.id, c]));

    const grouped: any = {};
    for (const match of matches) {
      if (!match.scheduledAt) continue;

      const date = match.scheduledAt.toISOString().split('T')[0];
      const court = courtMap.get(match.courtId);
      const sede = court?.sede || 'Principal';
      const courtName = court?.name || match.courtId;

      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][sede]) grouped[date][sede] = {};
      if (!grouped[date][sede][courtName]) grouped[date][sede][courtName] = [];

      grouped[date][sede][courtName].push({
        matchId: match.id,
        time: match.scheduledAt.toTimeString().slice(0, 5),
        round: match.round,
        category: match.category,
        groupLabel: (match as any).groupLabel || null,
        player1: playerMap.get(match.player1Id) || 'BYE',
        player2: playerMap.get(match.player2Id) || 'BYE',
        status: match.status,
        duration: `${match.estimatedDuration} min`,
      });
    }

    return grouped;
  }

  async saveScheduleDirectly(
    tournamentId: string,
    schedule: {
      matchId: string;
      time: string;
      date: string;
      courtId?: string;
      duration: string;
    }[],
    date: string,
  ) {
    await this.matchRepo
      .createQueryBuilder()
      .update()
      .set({ scheduledAt: null, courtId: null, estimatedDuration: 90 })
      .where('tournamentId = :tournamentId', { tournamentId })
      .andWhere('status = :status', { status: MatchStatus.PENDING })
      .execute();

    let saved = 0;
    for (const item of schedule) {
      const dateStr = item.date || date;
      const dt = new Date(`${dateStr}T${item.time}:00`);
      const duration = parseInt(item.duration) || 90;
      await this.matchRepo.update(item.matchId, {
        scheduledAt: dt,
        courtId: item.courtId || null,
        estimatedDuration: duration,
        status: MatchStatus.PENDING,
      });
      saved++;
    }

    return {
      date,
      matchesScheduled: saved,
      matchesPending: 0,
      courtsUsed: [
        ...new Set(schedule.map((s) => s.courtId).filter(Boolean)),
      ].length,
      schedule,
      message: `${saved} partidos guardados correctamente`,
    };
  }
}
