import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from '../matches/match.entity';
import { Court } from '../courts/court.entity';
import { CourtSchedule } from '../courts/court-schedule.entity';

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(Match)
    private matchRepo: Repository<Match>,
    @InjectRepository(Court)
    private courtRepo: Repository<Court>,
    @InjectRepository(CourtSchedule)
    private scheduleRepo: Repository<CourtSchedule>,
  ) {}

  // ── GENERAR PROGRAMACIÓN AUTOMÁTICA ────────────
  async generateSchedule(tournamentId: string, date: string) {
    // 1. Obtener partidos pendientes del torneo
    const matches = await this.matchRepo.find({
      where: {
        tournamentId,
        status: MatchStatus.PENDING,
      },
      order: { round: 'ASC' },
    });

    if (matches.length === 0) {
      throw new Error('No hay partidos pendientes para programar');
    }

    // 2. Obtener canchas disponibles para esa fecha
    const courts = await this.courtRepo.find({
      where: { isActive: true },
    });

    if (courts.length === 0) {
      throw new Error('No hay canchas activas disponibles');
    }

    // 3. Construir slots de tiempo por cancha
    // Cada slot = 90 minutos (duración estimada por defecto)
    const slots = this.buildTimeSlots(courts, date);

    // 4. Asignar partidos a slots
    const assignments = [];
    let slotIndex = 0;

    for (const match of matches) {
      if (slotIndex >= slots.length) break;

      const slot = slots[slotIndex];

      // Calcular duración según la ronda
      // Art. 5: SF y F duran más (best of 3)
      const duration = this.getEstimatedDuration(match.round);

      // Asignar cancha y horario al partido
      match.courtId = slot.courtId;
      match.scheduledAt = new Date(`${date}T${slot.time}:00`);
      match.estimatedDuration = duration;

      await this.matchRepo.save(match);

      // Marcar el slot como ocupado
      assignments.push({
        matchId: match.id,
        court: slot.courtName,
        date,
        time: slot.time,
        duration: `${duration} min`,
        round: match.round,
        category: match.category,
      });

      slotIndex++;
    }

    return {
      date,
      courtsUsed: courts.length,
      matchesScheduled: assignments.length,
      matchesPending: matches.length - assignments.length,
      schedule: assignments,
    };
  }

  // ── CONSTRUIR SLOTS DE TIEMPO ───────────────────
  // Genera slots de 90 minutos desde las 8:00 hasta las 20:00
  private buildTimeSlots(courts: Court[], date: string) {
    const slots = [];
    const startHour = 8;   // 8:00 AM
    const endHour = 20;    // 8:00 PM
    const slotDuration = 90; // minutos

    for (const court of courts) {
      let currentHour = startHour;
      let currentMin = 0;

      while (currentHour < endHour) {
        const time = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

        slots.push({
          courtId: court.id,
          courtName: court.name,
          time,
          date,
        });

        // Avanzar al siguiente slot
        currentMin += slotDuration;
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;
        }
      }
    }

    return slots;
  }

  // ── DURACIÓN ESTIMADA POR RONDA ─────────────────
  // Art. 5 LAT: SF y F son best of 3 → más tiempo
  private getEstimatedDuration(round: string): number {
    const durations = {
      'R64': 75,   // Best of 2 → ~75 min
      'R32': 75,
      'R16': 75,
      'QF':  90,   // Cuartos → ~90 min
      'SF':  120,  // Semifinal best of 3 → ~120 min
      'F':   150,  // Final best of 3 → ~150 min
      'RR':  75,   // Round Robin → ~75 min
      'RR_A': 75,
      'RR_B': 75,
      'SF_M': 120,
      'F_M':  150,
    };
    return durations[round] || 90;
  }

  // ── VER PROGRAMACIÓN DE UN TORNEO ──────────────
  async getSchedule(tournamentId: string) {
    const matches = await this.matchRepo.find({
      where: { tournamentId },
      order: { scheduledAt: 'ASC' },
    });

    // Agrupar por fecha y cancha
    const grouped = {};
    for (const match of matches) {
      if (!match.scheduledAt) continue;

      const date = match.scheduledAt.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = {};

      const court = match.courtId || 'Sin asignar';
      if (!grouped[date][court]) grouped[date][court] = [];

      grouped[date][court].push({
        time: match.scheduledAt.toTimeString().slice(0, 5),
        round: match.round,
        category: match.category,
        player1: match.player1Id,
        player2: match.player2Id,
        status: match.status,
        duration: `${match.estimatedDuration} min`,
      });
    }

    return grouped;
  }
}
