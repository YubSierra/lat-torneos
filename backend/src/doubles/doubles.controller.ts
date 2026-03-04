import { Controller, Get, Post, Patch,
         Param, Body, UseGuards } from '@nestjs/common';
import { DoublesService } from './doubles.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('doubles')
export class DoublesController {
  constructor(private doublesService: DoublesService) {}

  // GET /doubles/tournament/:id — parejas del torneo
  @Get('tournament/:id')
  getTeams(@Param('id') id: string) {
    return this.doublesService.getTeamsByTournament(id);
  }

  // GET /doubles/tournament/:id/unpaired — jugadores sin pareja
  @Get('tournament/:id/unpaired')
  getUnpaired(@Param('id') id: string) {
    return this.doublesService.getUnpairedPlayers(id);
  }

  // POST /doubles/tournament/:id/team — crear pareja
  @Post('tournament/:id/team')
  @UseGuards(JwtAuthGuard)
  createTeam(
    @Param('id') tournamentId: string,
    @Body() body: {
      player1Id: string;
      player2Id?: string;
      teamName?: string;
    },
  ) {
    return this.doublesService.createTeam(
      tournamentId,
      body.player1Id,
      body.player2Id,
      body.teamName,
    );
  }

  // PATCH /doubles/team/:id/pair — emparejar (admin)
  @Patch('team/:id/pair')
  @UseGuards(JwtAuthGuard, RolesGuard)
  pairPlayers(
    @Param('id') teamId: string,
    @Body() body: { player2Id: string },
  ) {
    return this.doublesService.pairPlayers(teamId, body.player2Id);
  }

  // PATCH /doubles/team/:id/approve-payment — aprobar pago manual
  @Patch('team/:id/approve-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  approvePayment(@Param('id') teamId: string) {
    return this.doublesService.approvePayment(teamId);
  }
}
