import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Tournament, TournamentType } from './tournament.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RefereeAssignment } from '../users/referee-assignment.entity';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private repo: Repository<Tournament>,
    @InjectRepository(RefereeAssignment)
    private assignmentRepo: Repository<RefereeAssignment>,
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

    try { await this.repo.manager.query('DELETE FROM matches WHERE "tournamentId" = $1', [id]); } catch (e) {}
    try { await this.repo.manager.query('DELETE FROM doubles_teams WHERE "tournamentId" = $1', [id]); } catch (e) {}
    try { await this.repo.manager.query('DELETE FROM enrollments WHERE "tournamentId" = $1', [id]); } catch (e) {}
    try { await this.repo.manager.query('DELETE FROM ranking_history WHERE "tournamentId" = $1', [id]); } catch (e) {}

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
          bestOf: 2, // Hasta QF: mejor de 2 sets
          bestOfSemiFinal: 3, // SF y F: mejor de 3 sets
          tiebreak: true,
          advantages: false, // Sin ventajas hasta SF
          advantagesSF: true, // Con ventajas en SF y F
        };

      case TournamentType.ROUND_ROBIN:
        return {
          type: 'round_robin',
          bestOf: 2,
          matchTiebreak: true, // MTB si empate a sets
          noAd: true,
          tiebreakPoints: 10,
        };

      case TournamentType.MASTER:
        return {
          type: 'master',
          groups: 2, // 2 grupos Round Robin
          topAdvance: 2, // Los 2 primeros de cada grupo avanzan
          finalFormat: 'elimination',
          minPlayers: 6, // Art. 5: mínimo 6 inscritos
        };

      case TournamentType.AMERICANO:
        return {
          type: 'americano',
          rotatePartners: true, // Parejas cambian cada set
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
      case TournamentType.SHORT_SET:
        return {
          type: 'short_set',
          format: '3 de 5 short sets',
          // Cada set se juega a 4 games (primero en llegar gana)
          gamesToWinSet: 4,
          setsToWinMatch: 3,
          totalSets: 5,
          // Empate a 3-3 en games → jugar séptimo short set
          tieAtGames: 3,
          seventhSet: true,
          // Empate en séptimo set → tiebreak a 7 puntos con diferencia de 2
          finalTiebreak: {
            points: 7,
            mustWinByTwo: true,
          },
          noAd: false,
          description:
            '3 de 5 short sets. Cada set a 4 games. ' +
            'Empate 3-3 → 7mo short set. ' +
            'Empate en 7mo → tiebreak a 7 pts con diferencia de 2.',
        };

      case TournamentType.PRO_SET:
        return {
          type: 'pro_set',
          format: '1 Pro Set a 8 games',
          // Un solo set a 8 games, sin ventajas
          gamesToWin: 8,
          noAd: true,
          // Empate a 8-8 → Match Tiebreak a 10 puntos
          tieAt: 8,
          matchTiebreak: {
            points: 10,
            mustWinByTwo: true,
          },
          description:
            '1 Pro Set a 8 games sin ventajas. ' +
            'Empate 8-8 → Match Tiebreak a 10 puntos con diferencia de 2.',
        };

      default:
        return { type };
    }
  }

  // ── ASIGNACIONES DE ÁRBITRO ──────────────────────
  async getAssignmentsByReferee(refereeId: string) {
    return this.assignmentRepo.find({ where: { refereeId } });
  }

  async findByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.repo
      .createQueryBuilder('t')
      .where('t.id IN (:...ids)', { ids })
      .orderBy('t.startDate', 'DESC')
      .getMany();
  }
}
