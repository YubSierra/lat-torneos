import { Controller, Get, Post, Patch, Delete,
         Param, Body, UseGuards, Request } from '@nestjs/common';
import { DoublesService } from './doubles.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('doubles')
export class DoublesController {
  constructor(private doublesService: DoublesService) {}

  // GET /doubles/tournament/:id
  @Get('tournament/:id')
  getTeams(@Param('id') id: string) {
    return this.doublesService.getTeamsByTournament(id);
  }

  // GET /doubles/tournament/:id/unpaired
  @Get('tournament/:id/unpaired')
  getUnpaired(@Param('id') id: string) {
    return this.doublesService.getUnpairedPlayers(id);
  }

  // POST /doubles/tournament/:id/team
  @Post('tournament/:id/team')
  @UseGuards(JwtAuthGuard)
  createTeam(
    @Param('id') tournamentId: string,
    @Body() body: { player1Id: string; player2Id?: string; teamName?: string },
    @Request() req: any,
  ) {
    const isAdmin = req.user?.role === 'admin';
    return this.doublesService.createTeam(
      tournamentId,
      body.player1Id,
      body.player2Id,
      body.teamName,
      isAdmin,
    );
  }

  // DELETE /doubles/team/:id
  @Delete('team/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  deleteTeam(@Param('id') teamId: string) {
    return this.doublesService.deleteTeam(teamId);
  }

  // PATCH /doubles/team/:id  — editar pareja
  @Patch('team/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateTeam(
    @Param('id') teamId: string,
    @Body() body: { player1Id: string; player2Id?: string; teamName?: string },
  ) {
    return this.doublesService.updateTeam(
      teamId,
      body.player1Id,
      body.player2Id || null,
      body.teamName || null,
    );
  }

  // PATCH /doubles/team/:id/pair
  @Patch('team/:id/pair')
  @UseGuards(JwtAuthGuard, RolesGuard)
  pairPlayers(
    @Param('id') teamId: string,
    @Body() body: { player2Id: string },
  ) {
    return this.doublesService.pairPlayers(teamId, body.player2Id);
  }

  // PATCH /doubles/team/:id/approve-payment
  // Aprueba el pago completo de la pareja (compatibilidad)
  @Patch('team/:id/approve-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  approvePayment(@Param('id') teamId: string) {
    return this.doublesService.approvePayment(teamId);
  }

  // PATCH /doubles/team/:id/approve-payment/1  → aprueba pago del jugador 1
  // PATCH /doubles/team/:id/approve-payment/2  → aprueba pago del jugador 2
  @Patch('team/:id/approve-payment/1')
  @UseGuards(JwtAuthGuard, RolesGuard)
  approvePlayer1(@Param('id') teamId: string) {
    return this.doublesService.approvePlayer1Payment(teamId);
  }

  @Patch('team/:id/approve-payment/2')
  @UseGuards(JwtAuthGuard, RolesGuard)
  approvePlayer2(@Param('id') teamId: string) {
    return this.doublesService.approvePlayer2Payment(teamId);
  }

  // POST /doubles/tournament/:id/merge-categories
  @Post('tournament/:id/merge-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  mergeCategories(
    @Param('id') tournamentId: string,
    @Body() body: { from: string; to: string },
  ) {
    return this.doublesService.mergeCategories(tournamentId, body.from, body.to);
  }

  // PATCH /doubles/team/:id/change-category
  @Patch('team/:id/change-category')
  @UseGuards(JwtAuthGuard, RolesGuard)
  changeTeamCategory(
    @Param('id') teamId: string,
    @Body() body: { newCategory: string },
  ) {
    return this.doublesService.changeTeamCategory(teamId, body.newCategory);
  }
}
