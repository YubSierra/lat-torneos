// backend/src/matches/matches.controller.ts
import { Controller, Get, Post, Patch, Delete,
         Body, Param, Query, UseGuards } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { UpdateScoreDto } from './dto/update-score.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  // ── RUTAS ESPECÍFICAS PRIMERO (antes de las genéricas /:id) ───────────────
  // ⚠️ IMPORTANTE: En NestJS las rutas estáticas deben ir ANTES que las
  // dinámicas (/:id) para evitar conflictos de coincidencia.

  // GET /matches/tournament/:id — partidos de un torneo
  @Get('tournament/:id')
  findByTournament(@Param('id') id: string) {
    return this.matchesService.findByTournament(id);
  }

  // GET /matches/tournament/:id/category/:cat
  @Get('tournament/:id/category/:cat')
  getByCategory(
    @Param('id') id: string,
    @Param('cat') cat: string,
  ) {
    return this.matchesService.findByCategory(id, cat);
  }

  // GET /matches/tournament/:id/rr-status/:category
  @Get('tournament/:id/rr-status/:category')
  getRRStatus(
    @Param('id') id: string,
    @Param('category') category: string,
  ) {
    return this.matchesService.getRRGroupStatus(id, category);
  }

  // GET /matches/tournament/:id/pending-unscheduled — partidos sin programar
  @Get('tournament/:id/pending-unscheduled')
  @UseGuards(JwtAuthGuard)
  getPendingUnscheduled(@Param('id') id: string) {
    return this.matchesService.getPendingUnscheduled(id);
  }

  // GET /matches/tournament/:id/suspended — partidos suspendidos
  @Get('tournament/:id/suspended')
  @UseGuards(JwtAuthGuard)
  getSuspended(@Param('id') id: string) {
    return this.matchesService.getSuspendedMatches(id);
  }

  // GET /matches/tournament/:id/draw-summary — resumen del cuadro por categoría
  @Get('tournament/:id/draw-summary')
  @UseGuards(JwtAuthGuard)
  getDrawSummary(
    @Param('id') tournamentId: string,
    @Query('category') category: string,
  ) {
    return this.matchesService.getDrawSummary(tournamentId, category);
  }

  // GET /matches/tournament/:id/categories — categorías activas del torneo
  @Get('tournament/:id/categories')
  @UseGuards(JwtAuthGuard)
  getCategories(@Param('id') id: string) {
    return this.matchesService.getCategoriesByTournament(id);
  }

  // GET /matches/tournament/:id/pending-rounds — rondas pendientes/suspendidas sin programar
  @Get('tournament/:id/pending-rounds')
  getPendingRounds(@Param('id') id: string) {
    return this.matchesService.getPendingRounds(id);
  }

  // GET /matches/player/:id/stats
  @Get('player/:id/stats')
  getPlayerStats(@Param('id') id: string) {
    return this.matchesService.getPlayerStats(id);
  }

  // POST /matches/tournament/:id/generate-main-draw
  @Post('tournament/:id/generate-main-draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateMainDraw(
    @Param('id') id: string,
    @Body() body: { category: string; advancingPerGroup: number },
  ) {
    return this.matchesService.generateMainDrawFromRR(
      id,
      body.category,
      body.advancingPerGroup || 1,
    );
  }

  // DELETE /matches/tournament/:id/schedule/:date — limpiar programación del día
  // ⚠️ Debe ir ANTES de DELETE /:id para evitar conflicto
  @Delete('tournament/:id/schedule/:date')
  @UseGuards(JwtAuthGuard)
  clearSchedule(
    @Param('id') tournamentId: string,
    @Param('date') date: string,
    @Query('modality') modality?: 'all' | 'singles' | 'doubles',
  ) {
    return this.matchesService.clearScheduleByDate(
      tournamentId,
      date,
      modality,
    );
  }

  // DELETE /matches/tournament/:id/draw — eliminar cuadro
  @Delete('tournament/:id/draw')
  @UseGuards(JwtAuthGuard)
  deleteDraw(
    @Param('id') tournamentId: string,
    @Query('category') category: string,
    @Query('drawType') drawType: 'rr' | 'maindraw' | 'all',
  ) {
    return this.matchesService.deleteDraw(tournamentId, category, drawType);
  }

  // ── RUTAS GENÉRICAS (/:id) AL FINAL ───────────────────────────────────────

  // GET /matches/:id/live — público
  @Get(':id/live')
  getMatchLive(@Param('id') id: string) {
    return this.matchesService.getMatchWithFormat(id);
  }

  // PATCH /matches/:id/start
  @Patch(':id/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  startMatch(@Param('id') id: string) {
    return this.matchesService.startMatch(id);
  }

  // PATCH /matches/:id/score
  @Patch(':id/score')
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateScore(@Body() dto: UpdateScoreDto) {
    return this.matchesService.updateScore(dto);
  }

  // PATCH /matches/:id/walkover
  @Patch(':id/walkover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  declareWalkover(
    @Param('id') id: string,
    @Body() body: { winnerId: string },
  ) {
    return this.matchesService.declareWalkover(id, body.winnerId);
  }

  // PATCH /matches/:id/double-walkover — ninguno se presentó
  // Sin ganador, sin puntos, resultado 0-0
  @Patch(':id/double-walkover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  declareDoubleWalkover(@Param('id') id: string) {
    return this.matchesService.declareDoubleWalkover(id);
  }

  // PATCH /matches/:id/unschedule — liberar partido (quitar horario)
  @Patch(':id/unschedule')
  @UseGuards(JwtAuthGuard)
  unscheduleMatch(@Param('id') id: string) {
    return this.matchesService.unscheduleMatch(id);
  }

  // PATCH /matches/:id/reschedule — reasignar manualmente
  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard)
  rescheduleMatch(
    @Param('id') id: string,
    @Body() body: { date: string; time: string; courtId: string; duration?: number },
  ) {
    return this.matchesService.rescheduleMatch(
      id, body.date, body.time, body.courtId, body.duration ?? 90,
    );
  }

  // DELETE /matches/:id — eliminar partido
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  removeMatch(@Param('id') id: string) {
    return this.matchesService.removeMatch(id);
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard)
  suspendMatch(
    @Param('id') id: string,
    @Body() body: {
      reason?: string;
      resumeScheduledAt?: string;
      partialResult?: { sets1: number; sets2: number; games1: number; games2: number } | null;
    } = {},
  ) {
    return this.matchesService.suspendMatch(
      id,
      body.reason ?? 'Suspendido manualmente',
      body.resumeScheduledAt,
      body.partialResult,
    );
  }
}
