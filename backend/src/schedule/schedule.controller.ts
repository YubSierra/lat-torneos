import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DrawService } from './draw.service';
import { SchedulingService } from './scheduling.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TournamentType } from '../tournaments/tournament.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

@Controller('tournaments/:tournamentId')
export class ScheduleController {
  constructor(
    private drawService: DrawService,
    private schedulingService: SchedulingService,
    private mailService: MailService,
    @InjectRepository(Enrollment) private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User) private userRepo: Repository<User>,
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

  // PUT /tournaments/:id/draw/rr-groups  ← editar grupos RR manualmente
  @Put('draw/rr-groups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  editRRGroups(
    @Param('tournamentId') tournamentId: string,
    @Body() body: { category: string; groups: Record<string, string[]> },
  ) {
    return this.drawService.editRRGroups(
      tournamentId,
      body.category,
      body.groups,
    );
  }

  // POST /tournaments/:id/schedule/preview  ← simula, NO guarda
  @Post('schedule/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  previewSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body()
    body: {
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
      false, // save=false → previewOnly
    );
  }

  // POST /tournaments/:id/schedule  ← guarda en BD
  @Post('schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  generateSchedule(
    @Param('tournamentId') tournamentId: string,
    @Body()
    body: {
      date: string;
      courts: { courtId: string; blocks: { start: string; end: string }[] }[];
      roundDurations: Record<string, number>;
      maxMatchesPerPlayer?: number;
      categories?: string[];
      roundFilter?: string[];
      restTimeBetweenMatches?: number;
      singlesDoublesGap?: number;
      roundBreakTime?: number;
    },
  ) {
    return this.schedulingService.generateSchedule(
      tournamentId,
      body.date,
      body.courts,
      body.roundDurations,
      body.maxMatchesPerPlayer ?? 2,
      body.categories,
      body.roundFilter,
      true,
      true,
      body.restTimeBetweenMatches ?? 0,
      body.singlesDoublesGap ?? 0,
      body.roundBreakTime ?? 0,
    );
  }

  // GET /tournaments/:id/schedule
  @Get('schedule')
  getSchedule(@Param('tournamentId') tournamentId: string) {
    return this.schedulingService.getSchedule(tournamentId);
  }

  // POST /tournaments/:id/draw/repair  ← repara bracket corrompido (player1==player2)
  @Post('draw/repair')
  @UseGuards(JwtAuthGuard, RolesGuard)
  repairBracket(
    @Param('tournamentId') tournamentId: string,
    @Body() body: { category?: string },
  ) {
    return this.schedulingService.repairBracketForCategory(
      tournamentId,
      body?.category,
    );
  }

  // POST /tournaments/:id/draw/force-repair  ← reparación forzada por ctid (orden físico)
  @Post('draw/force-repair')
  @UseGuards(JwtAuthGuard, RolesGuard)
  forceRepairRound(
    @Param('tournamentId') tournamentId: string,
    @Body()
    body: {
      category: string;
      currentRound: string;
      nextRound: string;
    },
  ) {
    return this.schedulingService.forceRepairRound(
      tournamentId,
      body.category,
      body.currentRound,
      body.nextRound,
    );
  }

  // POST /tournaments/:id/draw/create-placeholders  ← crea SF/F placeholder para grupo único
  @Post('draw/create-placeholders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  createMainDrawPlaceholders(
    @Param('tournamentId') tournamentId: string,
    @Body() body: { category: string; advancingCount: number },
  ) {
    return this.drawService.createMainDrawPlaceholders(
      tournamentId,
      body.category,
      body.advancingCount,
    );
  }

  // ── EMAIL: POST /tournaments/:id/mail/schedule ─────────────────────────────
  // Envía el PDF de programación a todos los inscritos del torneo
  @Post('mail/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async sendScheduleEmail(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      tournamentName: string;
      dateLabel: string;
      pdfBase64: string;
      filename: string;
      category?: string;   // opcional: filtrar por categoría
    },
  ) {
    const whereClause: any = { tournamentId, status: In(['approved', 'reserved']) };
    if (body.category) whereClause.category = body.category;

    const enrollments = await this.enrollmentRepo.find({ where: whereClause });
    const playerIds   = [...new Set(enrollments.map(e => e.playerId))];
    const users       = playerIds.length
      ? await this.userRepo.find({ where: { id: In(playerIds) } })
      : [];
    const emails = users.map(u => u.email).filter(Boolean) as string[];

    const result = await this.mailService.sendScheduleEmail(
      emails,
      body.tournamentName,
      body.dateLabel,
      body.pdfBase64,
      body.filename,
    );
    return { ...result, total: emails.length };
  }

  // ── EMAIL: POST /tournaments/:id/mail/draw ─────────────────────────────────
  // Envía el cuadro (draw) a los inscritos de una categoría
  @Post('mail/draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async sendDrawEmail(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      tournamentName: string;
      category: string;
      pdfBase64?: string;
      filename?: string;
    },
  ) {
    const enrollments = await this.enrollmentRepo.find({
      where: { tournamentId, category: body.category, status: In(['approved', 'reserved']) },
    });
    const playerIds = [...new Set(enrollments.map(e => e.playerId))];
    const users     = playerIds.length
      ? await this.userRepo.find({ where: { id: In(playerIds) } })
      : [];
    const emails = users.map(u => u.email).filter(Boolean) as string[];

    const result = await this.mailService.sendDrawEmail(
      emails,
      body.tournamentName,
      body.category,
      body.pdfBase64,
      body.filename,
    );
    return { ...result, total: emails.length };
  }
}
