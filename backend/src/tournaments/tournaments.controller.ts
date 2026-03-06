import { Controller, Get, Post, Patch, Delete,
         Body, Param, UseGuards } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('tournaments')
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  // GET /tournaments — público, cualquiera puede ver los torneos
  @Get()
  findAll() {
    return this.tournamentsService.findAll();
  }

  // GET /tournaments/:id — ver un torneo específico
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  // POST /tournaments — solo admins pueden crear torneos
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(@Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(dto);
  }

  // PATCH /tournaments/:id — solo admins pueden editar
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() dto: Partial<CreateTournamentDto>) {
    return this.tournamentsService.update(id, dto);
  }

  // DELETE /tournaments/:id — solo admins pueden eliminar
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.tournamentsService.remove(id);
  }

  // GET /tournaments/:id/config — ver configuración de juego
  @Get(':id/config')
  async getConfig(@Param('id') id: string) {
    const tournament = await this.tournamentsService.findOne(id);
    return this.tournamentsService.getGameConfig(tournament.type, 0);
  }
}
