// backend/src/schedule/schedule.controller.ts  ← REEMPLAZA COMPLETO
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

  // POST /tournaments/:tournamentId/draw
  @Post('draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateDraw(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      category: string;
      type: TournamentType;
      advancingPerGroup?: number;
      modality?: string;
      roundGameFormats?: Record<string, any>;
      includeReserved?: boolean; // ← NUEVO
    },
  ) {
    return this.drawService.generateDraw(
      tournamentId,
      body.category,
      body.type,
      body.advancingPerGroup || 1,
      body.modality || 'singles',
      body.roundGameFormats || {},
      body.includeReserved ?? false, // ← NUEVO
    );
  }

  // POST /tournaments/:tournamentId/schedule/preview
  // Vista previa — calcula pero NO guarda en BD
  @Post('schedule/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  previewSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      date: string;
      courts: { courtId: string; blocks: { start: string; end: string }[] }[];
      roundDurations: Record<string, number>;
      maxMatchesPerPlayer?: number;
      roundFilter?: string[];
      includeSuspended?: boolean;
    },
  ) {
    return this.schedulingService.generateSchedule(
      tournamentId,
      body.date,
      body.courts,
      body.roundDurations,
      body.maxMatchesPerPlayer || 2,
      body.roundFilter,
      body.includeSuspended ?? true,
      false, // save = false → no guarda
    );
  }

  // POST /tournaments/:tournamentId/schedule/confirm
  // Confirma y guarda la programación en BD
  @Post('schedule/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  confirmSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      date: string;
      courts: { courtId: string; blocks: { start: string; end: string }[] }[];
      roundDurations: Record<string, number>;
      maxMatchesPerPlayer?: number;
      roundFilter?: string[];
      includeSuspended?: boolean;
    },
  ) {
    return this.schedulingService.generateSchedule(
      tournamentId,
      body.date,
      body.courts,
      body.roundDurations,
      body.maxMatchesPerPlayer || 2,
      body.roundFilter,
      body.includeSuspended ?? true,
      true, // save = true → guarda en BD
    );
  }

  // POST /tournaments/:tournamentId/schedule/save
  // Guarda directamente una programación editada por el usuario
  @Post('schedule/save')
  @UseGuards(JwtAuthGuard, RolesGuard)
  saveSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body()
    body: {
      schedule: {
        matchId: string;
        time: string;
        date: string;
        courtId: string;
        duration: string;
      }[];
      date: string;
    },
  ) {
    return this.schedulingService.saveScheduleDirectly(
      tournamentId,
      body.schedule,
      body.date,
    );
  }

  // GET /tournaments/:tournamentId/schedule
  @Get('schedule')
  getSchedule(@Param('tournamentId') tournamentId: string) {
    return this.schedulingService.getSchedule(tournamentId);
  }
}