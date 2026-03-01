import { Injectable } from '@nestjs/common';

@Injectable()
export class TournamentsService {}

async create(dto: CreateTournamentDto, adminId: string) {
  // Validar que el valor de inscripción está en el rango LAT
  if (dto.inscriptionValue < 50000 || dto.inscriptionValue > 150000) {
    throw new BadRequestException('Valor fuera del rango LAT ($50k-$150k)');
  }
  const tournament = this.repo.create({ ...dto, createdBy: adminId });
  return this.repo.save(tournament);
}


// Retorna la configuración de juego según el tipo de torneo
getGameConfig(type: TournamentType, playerCount: number) {
  // Art. 23: si hay menos de 8 jugadores, forzar Round Robin
  if (playerCount < 8 && type === TournamentType.ELIMINATION) {
    return { type: TournamentType.ROUND_ROBIN, reason: 'Art.23: < 8 jugadores' };
  }
  switch (type) {
    case TournamentType.AMERICANO:
      return { rotatePartners: true, setsPerMatch: 1, pointsTo: 6 };
    case TournamentType.SUPERTIEBREAK:
      return { matchTiebreak: true, pointsTo: 10, noAd: true };
    case TournamentType.KING_OF_COURT:
      return { winnerStays: true, challengerWaits: true };
    case TournamentType.BOX_LEAGUE:
      return { flexibleSchedule: true, durationWeeks: 4 };
    default:
      return { type };
  }
}
