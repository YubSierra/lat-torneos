import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
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
  @Post('draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateDraw(
    @Param('tournamentId') tournamentId: string,
    @Body()
    body: {
      category: string;
      type: TournamentType;
      advancingPerGroup?: number;
      modality?: string;
      roundGameFormats?: Record<string, any>;
      minPlayersPerGroup?: number;
    },
  ) {
    return this.drawService.generateDraw(
      tournamentId,
      body.category,
      body.type,
      body.advancingPerGroup ?? 1,
      body.modality ?? 'singles',
      body.roundGameFormats ?? {},
      body.minPlayersPerGroup ?? 3,
    );
  }

  // POST /tournaments/:id/schedule/preview  ← simula, NO guarda
  @Post('schedule/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  previewSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      date: string;
      courts: { courtId: string; blocks: { start: string; end: string }[] }[];
      roundDurations: Record<string, number>;
      maxMatchesPerPlayer?: number;
    },
  ) {
    return this.schedulingService.generateSchedule(
      tournamentId,
      body.date,
      body.courts,
      body.roundDurations,
      body.maxMatchesPerPlayer ?? 2,
      undefined, // categories
      undefined, // roundFilter
      undefined, // includeSuspended (usa default)
      false,     // save=false → previewOnly
    );
  }

  // POST /tournaments/:id/schedule  ← guarda en BD
  @Post('schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      date: string;
      courts: { courtId: string; blocks: { start: string; end: string }[] }[];
      roundDurations: Record<string, number>;
      maxMatchesPerPlayer?: number;
      categories?: string[];
      roundFilter?: string[];
    },
  ) {
    return this.schedulingService.generateSchedule(
      tournamentId,
      body.date,
      body.courts,
      body.roundDurations,
      body.maxMatchesPerPlayer || 2,
      body.categories,
      body.roundFilter,
    );
  }

  // GET /tournaments/:id/schedule
  @Get('schedule')
  getSchedule(@Param('tournamentId') tournamentId: string) {
    return this.schedulingService.getSchedule(tournamentId);
  }
}
