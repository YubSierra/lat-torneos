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

  @Post('schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      date: string;
      courts: { courtId: string; blocks: { start: string; end: string }[] }[];
      roundDurations: Record<string, number>;
    },
  ) {
    return this.schedulingService.generateSchedule(
      tournamentId,
      body.date,
      body.courts,
      body.roundDurations,
    );
  }

  @Get('schedule')
  getSchedule(@Param('tournamentId') tournamentId: string) {
    return this.schedulingService.getSchedule(tournamentId);
  }
}