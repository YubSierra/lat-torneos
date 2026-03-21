import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { formatPlayerName, toTitleCase } from '../common/name-format.util';
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

// Orden de rondas para respetar la secuencia: rondas anteriores se juegan primero
const ROUND_ORDER: Record<string, number> = {
  RR: 0, RR_A: 0, RR_B: 0,
  R64: 1, R32: 2, R16: 3,
  QF: 4, SF: 5, F: 6,
  SF_M: 5, F_M: 6,
};

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
    restTimeBetweenMatches: number = 0,
    singlesDoublesGap: number = 0,
  ) {
    if (!courtsAvailability?.length) {
      throw new Error('Debes seleccionar al menos una cancha con horario disponible');
    }

    // 0. Reparar bracket: propaga winners de partidos ya completados/WO a rondas siguientes
    // Esto cubre casos donde advanceWinner no fue llamado (ej: partidos BYE auto-completados)
    await this.repairBracketPropagation(tournamentId);

    // 1. Obtener partidos pendientes (y suspendidos si aplica)
    const statusFilter = includeSuspended
      ? [MatchStatus.PENDING, MatchStatus.SUSPENDED]
      : [MatchStatus.PENDING];

    // 1-pre. Liberar scheduledAt SOLO de los partidos que:
    //   a) No tienen fecha asignada aún (scheduledAt IS NULL), O
    //   b) Están asignados exactamente para este mismo día (se está re-programando el mismo día)
    // Esto evita que partidos ya programados en otros días sean borrados y re-asignados.
    if (save) {
      const clearQ = this.matchRepo
        .createQueryBuilder()
        .update()
        .set({ scheduledAt: null, courtId: null })
        .where('tournamentId = :tournamentId', { tournamentId })
        .andWhere('status IN (:...statuses)', { statuses: statusFilter })
        .andWhere('(scheduledAt IS NULL OR DATE(scheduledAt) = :date)', { date });

      if (categories && categories.length > 0) {
        clearQ.andWhere('category IN (:...categories)', { categories });
      }
      if (roundFilter && roundFilter.length > 0) {
        clearQ.andWhere('round IN (:...rounds)', { rounds: roundFilter });
      }
      await clearQ.execute();
    }

    // Solo tomar partidos sin fecha asignada (los de otro día quedaron intactos en el pre-clear)
    let matchQuery = this.matchRepo
      .createQueryBuilder('match')
      .where('match.tournamentId = :tournamentId', { tournamentId })
      .andWhere('match.status IN (:...statuses)', { statuses: statusFilter })
      .andWhere('match.scheduledAt IS NULL');

    if (roundFilter && roundFilter.length > 0) {
      matchQuery = matchQuery.andWhere('match.round IN (:...rounds)', { rounds: roundFilter });
    }

    let matches = await matchQuery.orderBy('match.createdAt', 'ASC').getMany();

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

    // 1c. Separar partidos con jugadores definidos vs placeholders (rondas futuras sin jugadores)
    // Los placeholders se incluyen en el horario como "Por definir vs Por definir"
    const placeholderMatchIds = new Set(
      matches.filter((m) => m.player1Id == null && m.player2Id == null).map((m) => m.id),
    );

    // 2. Ordenar partidos: primero RR según orden LAT, luego eliminación por ronda
    matches = this.sortMatchesByRROrder(matches);
    matches = this.sortMatchesByRoundOrder(matches);

    // 2b. Detectar categorías con un solo grupo RR → forzar una cancha
    const rrGroupCount = new Map<string, Set<string>>();
    matches.filter((m) => ['RR', 'RR_A', 'RR_B'].includes(m.round)).forEach((m) => {
      if (!rrGroupCount.has(m.category)) rrGroupCount.set(m.category, new Set());
      rrGroupCount.get(m.category)!.add((m as any).groupLabel || 'single');
    });
    const singleGroupRRCategories = new Set<string>();
    rrGroupCount.forEach((groups, cat) => {
      if (groups.size === 1) singleGroupRRCategories.add(cat);
    });
    const singleRRCourtLock = new Map<string, string>(); // category → courtId

    // 3. Obtener canchas
    const courtIds = courtsAvailability.map((c) => c.courtId);
    const courts = await this.courtRepo.find({ where: { id: In(courtIds) } });
    const courtMap = new Map(courts.map((c) => [c.id, c]));

    // 4. Construir slots
    const slots = this.buildSlotsFromBlocks(courtsAvailability, courtMap, date, roundDurations);
    if (slots.length === 0) {
      throw new Error('No hay slots disponibles con los horarios indicados');
    }

    // 5. Obtener partidos ya programados ese día (para validar conflictos de sede y horario)
    // Incluye PENDING con scheduledAt para detectar jugadores ya asignados a una sede
    // (p.ej.: singles programados antes, ahora se programa dobles por separado)
    const existingScheduled = await this.matchRepo
      .createQueryBuilder('m')
      .where('m.tournamentId = :tid', { tid: tournamentId })
      .andWhere('m.scheduledAt IS NOT NULL')
      .andWhere('DATE(m.scheduledAt) = :date', { date })
      .getMany();

    // Cargar canchas de los partidos ya programados (pueden estar fuera de courtsAvailability)
    const existingCourtIds = [
      ...new Set(existingScheduled.map((m) => m.courtId).filter(Boolean) as string[]),
    ].filter((cid) => !courtMap.has(cid));
    const existingCourts = existingCourtIds.length > 0
      ? await this.courtRepo.find({ where: { id: In(existingCourtIds) } })
      : [];
    const fullCourtMap = new Map<string, Court>([
      ...courtMap,
      ...existingCourts.map((c) => [c.id, c] as [string, Court]),
    ]);

    // 6. Obtener parejas de dobles para validar conflictos singles+dobles
    const doublesTeams = (await this.matchRepo.manager
      .getRepository('doubles_teams')
      .find({ where: { tournamentId } })) as any[];

    // Mapa: playerId → [teamId, teamId...] (para saber si juega dobles)
    const playerDoublesMap = new Map<string, string[]>();
    // Mapa: teamId → [player1Id, player2Id] (para resolver jugadores individuales de un equipo)
    const teamMembersMap = new Map<string, string[]>();
    doublesTeams.forEach((t: any) => {
      const members: string[] = [];
      if (t.player1Id) {
        if (!playerDoublesMap.has(t.player1Id)) playerDoublesMap.set(t.player1Id, []);
        playerDoublesMap.get(t.player1Id)!.push(t.id);
        members.push(t.player1Id);
      }
      if (t.player2Id) {
        if (!playerDoublesMap.has(t.player2Id)) playerDoublesMap.set(t.player2Id, []);
        playerDoublesMap.get(t.player2Id)!.push(t.id);
        members.push(t.player2Id);
      }
      teamMembersMap.set(t.id, members);
    });

    // Helper: obtener IDs de jugadores individuales dado un ID que puede ser de equipo o jugador
    const resolveIndividualPlayers = (id: string | null): string[] => {
      if (!id) return [];
      return teamMembersMap.get(id) ?? [id];
    };

    // 7. Verificar sede única para singles+dobles misma categoría mismo día
    this.validateSameSedeSinglesDoubles(matches, courtsAvailability, courtMap, date, tournamentId);

    // 8. Pre-cargar mapa de nombres (soporta singles y equipos de dobles)
    const allParticipantIds = [...new Set(
      matches.flatMap((m) => [m.player1Id, m.player2Id].filter(Boolean)),
    )];
    const nameMap = await this.buildNameMap(allParticipantIds);
    const resolveName = (id: string | null) => id ? (nameMap.get(id) || 'BYE') : 'BYE';

    // 9. Asignar partidos a slots con todas las validaciones
    const assignments = [];
    const playerMatchCount = new Map<string, number>(); // playerId → count ese día
    const playerScheduled = new Map<string, { start: number; end: number }[]>(); // playerId → slots ocupados
    const usedSlotsByCourt = new Map<string, Set<number>>(); // courtId → slots usados
    const playerSedeMap = new Map<string, string>(); // playerId → sede asignada (un jugador solo puede estar en una sede por día)
    // Tiempo mínimo de inicio por ronda POR CATEGORÍA: así cada categoría avanza independientemente
    // Clave: categoría base (sin _DOBLES) → Map<roundOrder, maxEndTime>
    const maxEndTimeByCategoryRound = new Map<string, Map<number, number>>();
    // Contador por ronda para numerar placeholders: "Cuartos 1", "Cuartos 2", etc.
    const placeholderCountByRound = new Map<string, number>();

    // Inicializar contadores con partidos ya programados este día
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
        // Fijar sede para jugadores ya programados (crítico para detectar conflictos inter-run)
        if (m.courtId) {
          const exCourt = fullCourtMap.get(m.courtId);
          if (exCourt) {
            const exSede = exCourt.sede || 'Principal';
            [
              ...resolveIndividualPlayers(m.player1Id),
              ...resolveIndividualPlayers(m.player2Id),
            ].forEach((pid) => {
              if (!playerSedeMap.has(pid)) playerSedeMap.set(pid, exSede);
            });
          }
        }
      }
    });

    for (const match of matches) {
      const duration = roundDurations[match.round] || 90;
      const p1 = match.player1Id;
      const p2 = match.player2Id;

      // Calcular tiempo mínimo de inicio POR CATEGORÍA:
      // - Solo espera rondas anteriores DE LA MISMA CATEGORÍA (no de otras categorías)
      // - Dentro de la misma ronda, dobles empieza después de que terminen los singles
      const baseRoundOrder = ROUND_ORDER[match.round] ?? 99;
      const isDoublesMatch = match.category.endsWith('_DOBLES');
      const baseCategory = match.category.replace('_DOBLES', '');
      // Clave compuesta: singles = roundOrder*2, dobles = roundOrder*2+1
      const thisRoundOrder = baseRoundOrder * 2 + (isDoublesMatch ? 1 : 0);
      const categoryRoundMap = maxEndTimeByCategoryRound.get(baseCategory) || new Map<number, number>();
      let minStartTime = 0;
      categoryRoundMap.forEach((endTime, order) => {
        if (order < thisRoundOrder) {
          minStartTime = Math.max(minStartTime, endTime);
        }
      });
      // Añadir tiempo de espera entre singles y dobles si el árbitro lo configuró
      if (isDoublesMatch && singlesDoublesGap > 0 && minStartTime > 0) {
        const singlesKey = baseRoundOrder * 2;
        if (categoryRoundMap.has(singlesKey)) {
          minStartTime += singlesDoublesGap;
        }
      }

      // Buscar slot válido
      let assigned = false;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const courtSlots = usedSlotsByCourt.get(slot.courtId) || new Set<number>();
        if (courtSlots.has(i)) continue;
        if (slot.duration < duration) continue;

        const slotStart = this.timeToMinutes(slot.time);
        const slotEnd = slotStart + duration;

        // ── VALIDACIÓN 0: respetar orden de rondas — la ronda no puede empezar antes de que terminen las anteriores ──
        if (slotStart < minStartTime) continue;

        const isPlaceholder = placeholderMatchIds.has(match.id);
        const isRR = ['RR', 'RR_A', 'RR_B'].includes(match.round);
        const court = courtMap.get(slot.courtId);
        const slotSede = court?.sede || 'Principal';

        if (!isPlaceholder) {
          // ── VALIDACIÓN 1: máx partidos por jugador (RR no aplica — juega todos) ──
          if (!isRR && maxMatchesPerPlayer > 0) {
            if (p1 && (playerMatchCount.get(p1) || 0) >= maxMatchesPerPlayer) continue;
            if (p2 && (playerMatchCount.get(p2) || 0) >= maxMatchesPerPlayer) continue;
          }

          // ── VALIDACIÓN 1b: RR de un solo grupo → misma cancha ──
          if (isRR && singleGroupRRCategories.has(match.category)) {
            const lockedCourt = singleRRCourtLock.get(match.category);
            if (lockedCourt && slot.courtId !== lockedCourt) continue;
          }

          // ── VALIDACIÓN 2: no mismo horario en dos canchas (respeta tiempo de descanso) ──
          if (p1 && this.hasTimeConflict(playerScheduled.get(p1) || [], slotStart, slotEnd, restTimeBetweenMatches)) continue;
          if (p2 && this.hasTimeConflict(playerScheduled.get(p2) || [], slotStart, slotEnd, restTimeBetweenMatches)) continue;

          // ── VALIDACIÓN 3: no singles y dobles al mismo tiempo ──
          if (p1 && this.hasDoublesConflict(p1, slotStart, slotEnd, playerScheduled, playerDoublesMap, match)) continue;
          if (p2 && this.hasDoublesConflict(p2, slotStart, slotEnd, playerScheduled, playerDoublesMap, match)) continue;

          // ── VALIDACIÓN 4: un jugador no puede estar en dos sedes diferentes el mismo día ──
          const matchPlayers = [
            ...resolveIndividualPlayers(p1),
            ...resolveIndividualPlayers(p2),
          ];
          const sedeConflict = matchPlayers.some((pid) => {
            const assignedSede = playerSedeMap.get(pid);
            return assignedSede !== undefined && assignedSede !== slotSede;
          });
          if (sedeConflict) continue;

          // ── VALIDACIÓN 5: singles y dobles misma categoría → misma sede ──
          if (court && !this.validateCategorySede(match, court, assignments)) continue;
        }

        // ✅ Slot válido — asignar (save se hace en batch al final)

        // Actualizar contadores y sede del jugador
        if (!isPlaceholder) {
          [p1, p2].filter(Boolean).forEach((pid) => {
            playerMatchCount.set(pid!, (playerMatchCount.get(pid!) || 0) + 1);
            if (!playerScheduled.has(pid!)) playerScheduled.set(pid!, []);
            playerScheduled.get(pid!)!.push({ start: slotStart, end: slotEnd });
          });
          // Fijar sede para cada jugador individual del partido
          const assignedPlayers = [
            ...resolveIndividualPlayers(p1),
            ...resolveIndividualPlayers(p2),
          ];
          assignedPlayers.forEach((pid) => {
            if (!playerSedeMap.has(pid)) playerSedeMap.set(pid, slotSede);
          });
        }

        if (!usedSlotsByCourt.has(slot.courtId)) usedSlotsByCourt.set(slot.courtId, new Set());
        usedSlotsByCourt.get(slot.courtId)!.add(i);

        // Actualizar tiempo máximo de fin para esta ronda (por categoría + clave compuesta singles/dobles)
        if (!maxEndTimeByCategoryRound.has(baseCategory)) {
          maxEndTimeByCategoryRound.set(baseCategory, new Map());
        }
        const catRoundMap = maxEndTimeByCategoryRound.get(baseCategory)!;
        const prevMax = catRoundMap.get(thisRoundOrder) || 0;
        catRoundMap.set(thisRoundOrder, Math.max(prevMax, slotEnd));

        // Fijar cancha para RR de grupo único
        if (isRR && singleGroupRRCategories.has(match.category) && !singleRRCourtLock.has(match.category)) {
          singleRRCourtLock.set(match.category, slot.courtId);
        }

        let player1Name = resolveName(p1);
        let player2Name = resolveName(p2);
        if (isPlaceholder) {
          const roundKey = `${match.category}_${match.round}`;
          const n = (placeholderCountByRound.get(roundKey) || 0) + 1;
          placeholderCountByRound.set(roundKey, n);
          player1Name = `Jugador por definir ${n}A`;
          player2Name = `Jugador por definir ${n}B`;
        }

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
          player1: player1Name,
          player2: player2Name,
          isPlaceholder,
          gameFormat: match.gameFormat || null,
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

  // ── REPARAR BRACKET: propaga winners de partidos completados/WO a rondas siguientes ──
  // Esto cubre el caso donde advanceWinner no fue llamado (p.ej. partidos BYE creados
  // automáticamente como COMPLETED al generar el cuadro, sin pasar por el endpoint de WO).
  private async repairBracketPropagation(tournamentId: string): Promise<void> {
    const ROUND_PROGRESSION: Record<string, string> = {
      R64: 'R32', R32: 'R16', R16: 'QF', QF: 'SF', SF: 'F', SF_M: 'F_M',
    };

    const completed = await this.matchRepo.find({
      where: {
        tournamentId,
        status: In([MatchStatus.COMPLETED, MatchStatus.WO]),
      },
      order: { createdAt: 'ASC' },
    });

    const toSave: Match[] = [];

    for (const match of completed) {
      if (!match.winnerId) continue;
      const nextRound = ROUND_PROGRESSION[match.round as string];
      if (!nextRound) continue;

      const allInRound = await this.matchRepo.find({
        where: { tournamentId, category: match.category, round: match.round as any },
        order: { createdAt: 'ASC' },
      });
      const matchIndex = allInRound.findIndex((m) => m.id === match.id);
      if (matchIndex === -1) continue;

      const pairOffset = matchIndex % 2;
      const pairIndex  = Math.floor(matchIndex / 2);

      const nextMatches = await this.matchRepo.find({
        where: { tournamentId, category: match.category, round: nextRound as any },
        order: { createdAt: 'ASC' },
      });
      const nextMatch = nextMatches[pairIndex];
      if (!nextMatch) continue;

      if (pairOffset === 0 && !nextMatch.player1Id) {
        nextMatch.player1Id = match.winnerId;
        toSave.push(nextMatch);
      } else if (pairOffset === 1 && !nextMatch.player2Id) {
        nextMatch.player2Id = match.winnerId;
        toSave.push(nextMatch);
      }
    }

    if (toSave.length > 0) {
      await this.matchRepo.save(toSave);
    }
  }

  // ── RESOLVER NOMBRES: soporta tanto jugadores como equipos de dobles ──────
  private async buildNameMap(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();

    const doublesTeams = (await this.matchRepo.manager
      .getRepository('doubles_teams')
      .find({ where: { id: In(ids) } })) as any[];
    const teamIdSet = new Set(doublesTeams.map((t: any) => t.id));

    const singleIds = ids.filter((id) => !teamIdSet.has(id));
    const users = singleIds.length > 0
      ? await this.userRepo.find({ where: { id: In(singleIds) } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, formatPlayerName(u.nombres, u.apellidos)]));

    const memberIds = [...new Set(
      doublesTeams.flatMap((t: any) => [t.player1Id, t.player2Id].filter(Boolean)),
    )];
    const members = memberIds.length > 0
      ? await this.userRepo.find({ where: { id: In(memberIds) } })
      : [];
    const memberMap = new Map(members.map((u) => [u.id, formatPlayerName(u.nombres, u.apellidos)]));

    const result = new Map<string, string>(userMap);
    doublesTeams.forEach((t: any) => {
      const name = t.teamName
        ? toTitleCase(t.teamName)
        : [memberMap.get(t.player1Id), memberMap.get(t.player2Id)].filter(Boolean).join(' / ') ||
          'Por definir';
      result.set(t.id, name);
    });
    return result;
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

  // ── ORDENAR RONDAS DE ELIMINACIÓN EN SECUENCIA ──
  private sortMatchesByRoundOrder(matches: Match[]): Match[] {
    const rrMatches = matches.filter((m) => ['RR', 'RR_A', 'RR_B'].includes(m.round));
    const elim = matches.filter((m) => !['RR', 'RR_A', 'RR_B'].includes(m.round));
    // Prioridad: primero por ronda, luego singles antes que dobles (dobles siempre después)
    elim.sort((a, b) => {
      const roundDiff = (ROUND_ORDER[a.round] ?? 99) - (ROUND_ORDER[b.round] ?? 99);
      if (roundDiff !== 0) return roundDiff;
      const aIsDoubles = a.category.endsWith('_DOBLES') ? 1 : 0;
      const bIsDoubles = b.category.endsWith('_DOBLES') ? 1 : 0;
      return aIsDoubles - bIsDoubles;
    });
    // RR también: singles antes que dobles dentro del mismo round
    rrMatches.sort((a, b) => {
      const aIsDoubles = a.category.endsWith('_DOBLES') ? 1 : 0;
      const bIsDoubles = b.category.endsWith('_DOBLES') ? 1 : 0;
      return aIsDoubles - bIsDoubles;
    });
    return [...rrMatches, ...elim];
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
    restTime: number = 0,
  ): boolean {
    return existing.some((e) => newStart < e.end + restTime && newEnd > e.start - restTime);
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
    // Reparar bracket por si hay ganadores de BYE/WO no propagados aún
    await this.repairBracketPropagation(tournamentId);

    const matches = await this.matchRepo.find({
      where: { tournamentId },
      order: { scheduledAt: 'ASC' },
    });

    const allIds = [
      ...new Set(
        [...matches.map((m) => m.player1Id), ...matches.map((m) => m.player2Id)].filter(Boolean),
      ),
    ];
    const nameMap = await this.buildNameMap(allIds);
    const resolveName = (id: string | null) => id ? (nameMap.get(id) || 'BYE') : 'BYE';

    const courtIds = [...new Set(matches.map((m) => m.courtId).filter(Boolean))];
    const courts =
      courtIds.length > 0
        ? await this.courtRepo.find({ where: { id: In(courtIds) } })
        : [];
    const courtMap = new Map(courts.map((c) => [c.id, c]));

    const grouped: any = {};
    for (const match of matches) {
      if (!match.scheduledAt) continue;

      const d = match.scheduledAt;
      const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
        // null → 'Por definir'; ID no encontrado → 'BYE' (convertido a 'Por definir' en PDF)
        player1: match.player1Id == null ? 'Por definir' : resolveName(match.player1Id),
        player2: match.player2Id == null ? 'Por definir' : resolveName(match.player2Id),
        status: match.status,
        duration: `${match.estimatedDuration} min`,
        gameFormat: match.gameFormat || null,
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
