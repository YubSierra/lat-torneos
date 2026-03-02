import { Controller, Post, Get, Body,
         Param, UseGuards } from '@nestjs/common';
import { DrawService } from './draw.service';
import { SchedulingService } from './scheduling.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TournamentType } from '../tournaments/tournament.entity';

@Controller('tournaments/:tournamentId')
export class ScheduleController {
  constructor(
    private drawService: DrawService,
    private schedulingService: SchedulingService,
  ) {}

  // POST /tournaments/:id/draw
  // Generar el sorteo de llaves (solo admins)
  @Post('draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateDraw(
    @Param('tournamentId') tournamentId: string,
    @Body() body: { category: string; type: TournamentType },
  ) {
    return this.drawService.generateDraw(
      tournamentId,
      body.category,
      body.type,
    );
  }

  // POST /tournaments/:id/schedule
  // Generar programación automática (solo admins)
  @Post('schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body() body: { date: string },
  ) {
    return this.schedulingService.generateSchedule(
      tournamentId,
      body.date,
    );
  }

  // GET /tournaments/:id/schedule
  // Ver programación del torneo (público)
  @Get('schedule')
  getSchedule(@Param('tournamentId') tournamentId: string) {
    return this.schedulingService.getSchedule(tournamentId);
  }
}
