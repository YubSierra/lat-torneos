import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Match, MatchStatus } from '../matches/match.entity';
import { Court } from '../courts/court.entity';
import { CourtSchedule } from '../courts/court-schedule.entity';
import { User } from '../users/user.entity';

// Bloque de disponibilidad de una cancha
interface CourtBlock {
  start: string; // "08:00"
  end:   string; // "10:00"
}

interface CourtAvailability {
  courtId: string;
  blocks:  CourtBlock[];
}

// Duración por ronda en minutos
interface RoundDurations {
  R64?:  number;
  R32?:  number;
  R16?:  number;
  QF?:   number;
  SF?:   number;
  F?:    number;
  RR?:   number;
  RR_A?: number;
  RR_B?: number;
  SF_M?: number;
  F_M?:  number;
}

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
  ) {
    // 1. Obtener partidos pendientes
    const matches = await this.matchRepo.find({
      where: { tournamentId, status: MatchStatus.PENDING },
      order: { round: 'ASC' },
    });

    if (matches.length === 0) {
      throw new Error('No hay partidos pendientes para programar');
    }

    if (!courtsAvailability || courtsAvailability.length === 0) {
      throw new Error('Debes seleccionar al menos una cancha con horario disponible');
    }

    // 2. Obtener info de las canchas seleccionadas
    const courtIds = courtsAvailability.map(c => c.courtId);
    const courts = await this.courtRepo.find({
      where: { id: In(courtIds) },
    });

    const courtMap = new Map(courts.map(c => [c.id, c]));

    // 3. Construir slots de tiempo respetando los bloques
    const slots = this.buildSlotsFromBlocks(
      courtsAvailability,
      courtMap,
      date,
      roundDurations,
    );

    if (slots.length === 0) {
      throw new Error('No hay slots disponibles con los horarios indicados');
    }

    // 4. Asignar partidos a slots
    const assignments = [];
    let slotIndex = 0;

    for (const match of matches) {
      if (slotIndex >= slots.length) break;

      const duration = roundDurations[match.round] || 90;

      // Buscar slot con suficiente tiempo para esta ronda
      while (slotIndex < slots.length && slots[slotIndex].duration < duration) {
        slotIndex++;
      }
      if (slotIndex >= slots.length) break;

      const slot = slots[slotIndex];

      match.courtId      = slot.courtId;
      match.scheduledAt  = new Date(`${date}T${slot.time}:00`);
      match.estimatedDuration = duration;

      await this.matchRepo.save(match);

      // Obtener nombres de jugadores
      const player1 = match.player1Id
        ? await this.userRepo.findOne({ where: { id: match.player1Id } })
        : null;
      const player2 = match.player2Id
        ? await this.userRepo.findOne({ where: { id: match.player2Id } })
        : null;

      assignments.push({
        matchId:  match.id,
        sede:     slot.sede,
        court:    slot.courtName,
        date,
        time:     slot.time,
        duration: `${duration} min`,
        round:    match.round,
        category: match.category,
        player1:  player1 ? `${player1.nombres} ${player1.apellidos}` : 'BYE',
        player2:  player2 ? `${player2.nombres} ${player2.apellidos}` : 'BYE',
      });

      slotIndex++;
    }

    return {
      date,
      courtsUsed:       courts.length,
      matchesScheduled: assignments.length,
      matchesPending:   matches.length - assignments.length,
      schedule:         assignments,
    };
  }

  // ── CONSTRUIR SLOTS DESDE BLOQUES ───────────────
  private buildSlotsFromBlocks(
    courtsAvailability: CourtAvailability[],
    courtMap: Map<string, Court>,
    date: string,
    roundDurations: RoundDurations,
  ) {
    const slots = [];
    const minDuration = Math.min(...Object.values(roundDurations).filter(Boolean) as number[]) || 75;

    for (const courtAvail of courtsAvailability) {
      const court = courtMap.get(courtAvail.courtId);
      if (!court) continue;

      for (const block of courtAvail.blocks) {
        const startMinutes = this.timeToMinutes(block.start);
        const endMinutes   = this.timeToMinutes(block.end);
        let current        = startMinutes;

        while (current + minDuration <= endMinutes) {
          const remaining = endMinutes - current;
          slots.push({
            courtId:   court.id,
            courtName: court.name,
            sede:      court.sede || 'Principal',
            time:      this.minutesToTime(current),
            duration:  remaining,
          });
          current += minDuration;
        }
      }
    }

    // Ordenar por hora
    return slots.sort((a, b) =>
      this.timeToMinutes(a.time) - this.timeToMinutes(b.time)
    );
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

    // Obtener todos los IDs de jugadores únicos
    const playerIds = [...new Set([
      ...matches.map(m => m.player1Id),
      ...matches.map(m => m.player2Id),
    ].filter(Boolean))];

    // Buscar nombres de jugadores
    const players = playerIds.length > 0
      ? await this.userRepo.find({ where: { id: In(playerIds) } })
      : [];
    const playerMap = new Map(
      players.map(p => [p.id, `${p.nombres} ${p.apellidos}`])
    );

    // Obtener info de canchas
    const courtIds = [...new Set(matches.map(m => m.courtId).filter(Boolean))];
    const courts = courtIds.length > 0
      ? await this.courtRepo.find({ where: { id: In(courtIds) } })
      : [];
    const courtMap = new Map(courts.map(c => [c.id, c]));

    // Agrupar por fecha y sede/cancha
    const grouped: any = {};
    for (const match of matches) {
      if (!match.scheduledAt) continue;

      const date  = match.scheduledAt.toISOString().split('T')[0];
      const court = courtMap.get(match.courtId);
      const sede  = court?.sede || 'Principal';
      const courtName = court?.name || match.courtId;

      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][sede]) grouped[date][sede] = {};
      if (!grouped[date][sede][courtName]) grouped[date][sede][courtName] = [];

      grouped[date][sede][courtName].push({
        matchId:  match.id,
        time:     match.scheduledAt.toTimeString().slice(0, 5),
        round:    match.round,
        category: match.category,
        player1:  playerMap.get(match.player1Id) || 'BYE',
        player2:  playerMap.get(match.player2Id) || 'BYE',
        status:   match.status,
        duration: `${match.estimatedDuration} min`,
      });
    }

    return grouped;
  }
}
