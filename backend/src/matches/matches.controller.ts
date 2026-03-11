import { Controller, Get, Post, Patch, Delete,
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

  // DELETE /matches/:id — eliminar partido (admin)
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  removeMatch(@Param('id') id: string) {
    return this.matchesService.removeMatch(id);
  }

  // DELETE /matches/tournament/:id/schedule/:date — limpiar programación del día
  @Delete('tournament/:id/schedule/:date')
  @UseGuards(JwtAuthGuard)
  clearSchedule(
    @Param('id') tournamentId: string,
    @Param('date') date: string,
  ) {
    return this.matchesService.clearScheduleByDate(tournamentId, date);
  }

  // GET /matches/:id/live — público, no requiere auth
  @Get(':id/live')
  getMatchLive(@Param('id') id: string) {
    return this.matchesService.getMatchWithFormat(id);
  }

  // GET /matches/tournament/:id/rr-status/:category — estado del RR por grupo
  @Get('tournament/:id/rr-status/:category')
  getRRStatus(
    @Param('id') id: string,
    @Param('category') category: string,
  ) {
    return this.matchesService.getRRGroupStatus(id, category);
  }

  // PATCH /matches/:id/unschedule — quitar de la programación
  @Patch(':id/unschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  unscheduleMatch(@Param('id') id: string) {
    return this.matchesService.unscheduleMatch(id);
  }

  // PATCH /matches/:id/reschedule — reprogramar partido (admin/árbitro)
  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  rescheduleMatch(
    @Param('id') id: string,
    @Body() body: {
      scheduledAt: string;
      courtId?: string;
      estimatedDuration?: number;
      notes?: string;
    },
  ) {
    return this.matchesService.rescheduleMatch(id, body);
  }

  // PATCH /matches/:id/suspend — suspender partido individual
  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  suspendMatch(
    @Param('id') id: string,
    @Body() body: { reason: string; resumeScheduledAt?: string },
  ) {
    return this.matchesService.suspendMatch(id, body.reason, body.resumeScheduledAt);
  }

  // PATCH /matches/:id/resume — reanudar partido suspendido
  @Patch(':id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  resumeMatch(
    @Param('id') id: string,
    @Body() body: { newScheduledAt?: string },
  ) {
    return this.matchesService.resumeMatch(id, body.newScheduledAt);
  }

  // PATCH /matches/tournament/:id/suspend-day — suspender toda una jornada
  @Patch('tournament/:id/suspend-day')
  @UseGuards(JwtAuthGuard, RolesGuard)
  suspendDay(
    @Param('id') tournamentId: string,
    @Body() body: { date: string; reason: string; resumeScheduledAt?: string },
  ) {
    return this.matchesService.suspendTournamentDay(
      tournamentId, body.date, body.reason, body.resumeScheduledAt,
    );
  }

  // PATCH /matches/tournament/:id/resume-day — reanudar toda una jornada
  @Patch('tournament/:id/resume-day')
  @UseGuards(JwtAuthGuard, RolesGuard)
  resumeDay(
    @Param('id') tournamentId: string,
    @Body() body: { date: string },
  ) {
    return this.matchesService.resumeTournamentDay(tournamentId, body.date);
  }

  // GET /matches/tournament/:id/suspended — listar suspendidos
  @Get('tournament/:id/suspended')
  getSuspended(@Param('id') id: string) {
    return this.matchesService.getSuspendedMatches(id);
  }

  // GET /matches/tournament/:id/pending-rounds — rondas pendientes
  @Get('tournament/:id/pending-rounds')
  getPendingRounds(@Param('id') id: string) {
    return this.matchesService.getPendingRounds(id);
  }

  // POST /matches/tournament/:id/generate-main-draw — generar Main Draw desde RR
  @Post('tournament/:id/generate-main-draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateMainDraw(
    @Param('id') id: string,
    @Body() body: {
      category: string;
      advancingPerGroup: number;
    },
  ) {
    return this.matchesService.generateMainDrawFromRR(
      id,
      body.category,
      body.advancingPerGroup || 1,
    );
  }

  // GET /matches/tournament/:id/byes/:category
  @Get('tournament/:id/byes/:category')
  @UseGuards(JwtAuthGuard)
  getByesForCategory(
    @Param('id') tournamentId: string,
    @Param('category') category: string,
  ) {
    return this.matchesService.getByesForCategory(tournamentId, category);
  }

  // GET /matches/tournament/:id/pending-player/:playerId/:category
  @Get('tournament/:id/pending-player/:playerId/:category')
  @UseGuards(JwtAuthGuard)
  getPendingMatchesForPlayer(
    @Param('id') tournamentId: string,
    @Param('playerId') playerId: string,
    @Param('category') category: string,
  ) {
    return this.matchesService.getPendingMatchesForPlayer(
      tournamentId,
      category,
      playerId,
    );
  }

  // POST /matches/tournament/:id/assign-alternate-bye
  @Post('tournament/:id/assign-alternate-bye')
  @UseGuards(JwtAuthGuard, RolesGuard)
  assignAlternateToBye(
    @Param('id') tournamentId: string,
    @Body() body: {
      matchId: string;
      alternatePlayerId: string;
      category: string;
    },
  ) {
    return this.matchesService.assignAlternateToBye({
      matchId: body.matchId,
      alternatePlayerId: body.alternatePlayerId,
      tournamentId,
      category: body.category,
    });
  }

  // POST /matches/tournament/:id/replace-retired
  @Post('tournament/:id/replace-retired')
  @UseGuards(JwtAuthGuard, RolesGuard)
  replaceRetiredPlayer(
    @Param('id') tournamentId: string,
    @Body() body: {
      retiredPlayerId: string;
      alternatePlayerId: string;
      category: string;
    },
  ) {
    return this.matchesService.replaceRetiredPlayer({
      tournamentId,
      category: body.category,
      retiredPlayerId: body.retiredPlayerId,
      alternatePlayerId: body.alternatePlayerId,
    });
  }

  // PATCH /matches/:id/assign-slot
  @Patch(':id/assign-slot')
  @UseGuards(JwtAuthGuard)
  assignToSlot(
    @Param('id') id: string,
    @Body()
    body: {
      courtId: string;
      scheduledDate: string;
      scheduledTime: string;
      estimatedDuration: number;
    },
  ) {
    return this.matchesService.assignToSlot(id, body);
  }

  // GET /matches/tournament/:tournamentId/unscheduled
  @Get('tournament/:tournamentId/unscheduled')
  @UseGuards(JwtAuthGuard)
  getUnscheduled(@Param('tournamentId') tournamentId: string) {
    return this.matchesService.getUnscheduled(tournamentId);
  }
}
