import { Controller, Get, Post, Patch,
         Body, Param, UseGuards } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { UpdateScoreDto } from './dto/update-score.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  // GET /matches/tournament/:id — partidos de un torneo
  @Get('tournament/:id')
  findByTournament(@Param('id') id: string) {
    return this.matchesService.findByTournament(id);
  }

  // GET /matches/tournament/:id/category/:cat
  // Partidos por categoría
  @Get('tournament/:id/category/:cat')
  getByCategory(
    @Param('id') id: string,
    @Param('cat') cat: string,
  ) {
    return this.matchesService.findByCategory(id, cat);
  }

  // GET /matches/player/:id/stats — estadísticas de un jugador
  @Get('player/:id/stats')
  getPlayerStats(@Param('id') id: string) {
    return this.matchesService.getPlayerStats(id);
  }

  // PATCH /matches/:id/start — iniciar partido (árbitro)
  @Patch(':id/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  startMatch(@Param('id') id: string) {
    return this.matchesService.startMatch(id);
  }

  // PATCH /matches/:id/score — actualizar marcador (árbitro)
  @Patch(':id/score')
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateScore(@Body() dto: UpdateScoreDto) {
    return this.matchesService.updateScore(dto);
  }

  // PATCH /matches/:id/walkover — declarar W.O. (árbitro)
  // Art. 23 LAT: W.O. = 6-0 6-0 automático
  @Patch(':id/walkover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  declareWalkover(
    @Param('id') id: string,
    @Body() body: { winnerId: string },
  ) {
    return this.matchesService.declareWalkover(id, body.winnerId);
  }
}
