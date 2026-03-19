import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('tournaments')
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  // GET /tournaments/public — SIN auth, filtra borradores
  // ⚠️ DEBE ir ANTES de /:id para que NestJS no lo interprete como un ID
  @Get('public')
  findPublic() {
    return this.tournamentsService.findPublic();
  }

  // GET /tournaments — CON auth, muestra todos (incluyendo draft)
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.tournamentsService.findAll();
  }

  // GET /tournaments/referee/:refereeId — torneos asignados a árbitro
  @Get('referee/:refereeId')
  @UseGuards(JwtAuthGuard)
  async getTournamentsByReferee(@Param('refereeId') refereeId: string) {
    const assignments =
      await this.tournamentsService.getAssignmentsByReferee(refereeId);
    if (!assignments.length) return [];
    const tournamentIds = assignments.map((a: any) => a.tournamentId);
    return this.tournamentsService.findByIds(tournamentIds);
  }

  // GET /tournaments/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  // POST /tournaments
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(@Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(dto);
  }

  // PATCH /tournaments/:id
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() dto: Partial<CreateTournamentDto>) {
    return this.tournamentsService.update(id, dto);
  }

  // PATCH /tournaments/:id/rename-category
  @Patch(':id/rename-category')
  @UseGuards(JwtAuthGuard, RolesGuard)
  renameCategory(
    @Param('id') id: string,
    @Body() body: { oldName: string; newName: string },
  ) {
    return this.tournamentsService.renameCategory(id, body.oldName, body.newName);
  }

  // DELETE /tournaments/:id
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.tournamentsService.remove(id);
  }

  // GET /tournaments/:id/config
  @Get(':id/config')
  async getConfig(@Param('id') id: string) {
    const tournament = await this.tournamentsService.findOne(id);
    return this.tournamentsService.getGameConfig(tournament.type, 0);
  }
}
