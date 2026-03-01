import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament, TournamentType } from './tournament.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private repo: Repository<Tournament>,
  ) {}

  // ── CREAR TORNEO ────────────────────────────────
  async create(dto: CreateTournamentDto) {
    const tournament = this.repo.create(dto);
    return this.repo.save(tournament);
  }

  // ── LISTAR TODOS ────────────────────────────────
  async findAll() {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  // ── BUSCAR UNO ──────────────────────────────────
  async findOne(id: string) {
    const tournament = await this.repo.findOne({ where: { id } });
    if (!tournament) throw new NotFoundException('Torneo no encontrado');
    return tournament;
  }

  // ── ACTUALIZAR ──────────────────────────────────
  async update(id: string, dto: Partial<CreateTournamentDto>) {
    const tournament = await this.findOne(id);
    Object.assign(tournament, dto);
    return this.repo.save(tournament);
  }

  // ── ELIMINAR ────────────────────────────────────
  async remove(id: string) {
    const tournament = await this.findOne(id);
    await this.repo.remove(tournament);
    return { message: 'Torneo eliminado correctamente' };
  }

  // ── CONFIGURACIÓN DE JUEGO POR TIPO ─────────────
  // Retorna las reglas según el tipo de torneo (LAT + Recreativos)
  getGameConfig(type: TournamentType, playerCount: number) {

    // Art. 23: menos de 8 jugadores → Round Robin obligatorio
    if (playerCount < 8 && type === TournamentType.ELIMINATION) {
      return {
        type: TournamentType.ROUND_ROBIN,
        reason: 'Art. 23: menos de 8 jugadores, se juega todos contra todos',
      };
    }

    switch (type) {
      case TournamentType.ELIMINATION:
        return {
          type: 'elimination',
          bestOf: 2,           // Hasta QF: mejor de 2 sets
          bestOfSemiFinal: 3,  // SF y F: mejor de 3 sets
          tiebreak: true,
          advantages: false,   // Sin ventajas hasta SF
          advantagesSF: true,  // Con ventajas en SF y F
        };

      case TournamentType.ROUND_ROBIN:
        return {
          type: 'round_robin',
          bestOf: 2,
          matchTiebreak: true,  // MTB si empate a sets
          noAd: true,
          tiebreakPoints: 10,
        };

      case TournamentType.MASTER:
        return {
          type: 'master',
          groups: 2,            // 2 grupos Round Robin
          topAdvance: 2,        // Los 2 primeros de cada grupo avanzan
          finalFormat: 'elimination',
          minPlayers: 6,        // Art. 5: mínimo 6 inscritos
        };

      case TournamentType.AMERICANO:
        return {
          type: 'americano',
          rotatePartners: true,  // Parejas cambian cada set
          setsPerMatch: 1,
          pointsTo: 6,
          noAd: true,
          description: 'Todos juegan con todos como pareja',
        };

      case TournamentType.KING_OF_COURT:
        return {
          type: 'king_of_court',
          winnerStays: true,     // Ganador se queda en cancha
          challengerWaits: true, // Perdedor espera su turno
          pointsTo: 7,
          description: 'El ganador defiende la cancha contra el siguiente retador',
        };

      case TournamentType.SUPERTIEBREAK:
        return {
          type: 'supertiebreak',
          matchTiebreak: true,
          pointsTo: 10,          // MTB a 10 puntos
          noAd: true,
          description: 'Partidos de un solo supertiebreak a 10 puntos',
        };

      case TournamentType.BOX_LEAGUE:
        return {
          type: 'box_league',
          flexibleSchedule: true,  // Jugadores acuerdan horarios
          durationWeeks: 4,        // Duración del box
          bestOf: 2,
          description: 'Grupos fijos, partidos en horario libre dentro del plazo',
        };

      case TournamentType.LADDER:
        return {
          type: 'ladder',
          canChallengePositions: 2,  // Puedes retar hasta 2 posiciones arriba
          challengeExpireDays: 7,    // El retado tiene 7 días para responder
          bestOf: 2,
          description: 'Escalera de retos, el ganador sube posición',
        };

      default:
        return { type };
    }
  }
}
