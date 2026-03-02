import { Controller, Get, Post, Param,
         Body, UseGuards } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('rankings')
export class RankingsController {
  constructor(private rankingsService: RankingsService) {}

  // GET /rankings/:circuitLine/:category
  // Ver escalafón público por línea y categoría
  @Get(':circuitLine/:category')
  getRankings(
    @Param('circuitLine') circuitLine: string,
    @Param('category') category: string,
  ) {
    return this.rankingsService.getRankings(category, circuitLine);
  }

  // GET /rankings/player/:id/history
  // Ver historial completo de un jugador
  @Get('player/:id/history')
  getPlayerHistory(@Param('id') id: string) {
    return this.rankingsService.getPlayerHistory(id);
  }

  // POST /rankings/calculate/:matchId
  // Calcular puntos al completar un partido (Art. 7 + Art. 8)
  @Post('calculate/:matchId')
  @UseGuards(JwtAuthGuard)
  calculatePoints(@Param('matchId') matchId: string) {
    return this.rankingsService.calculateMatchPoints(matchId);
  }

  // GET /rankings/tiebreak/:tournamentId/:category
  // Desempate Round Robin con criterios ITF
  @Get('tiebreak/:tournamentId/:category')
  @UseGuards(JwtAuthGuard)
  tiebreak(
    @Param('tournamentId') tournamentId: string,
    @Param('category') category: string,
  ) {
    return this.rankingsService.tiebreakRoundRobin(tournamentId, category);
  }
}
