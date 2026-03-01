import { Controller, Get, Post, Body,
         Param, UseGuards } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

  // POST /enrollments — inscribir jugador
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  // GET /enrollments/tournament/:id — inscritos de un torneo
  @Get('tournament/:id')
  @UseGuards(JwtAuthGuard)
  findByTournament(@Param('id') id: string) {
    return this.enrollmentsService.findByTournament(id);
  }

  // GET /enrollments/player/:id — torneos de un jugador
  @Get('player/:id')
  @UseGuards(JwtAuthGuard)
  findByPlayer(@Param('id') id: string) {
    return this.enrollmentsService.findByPlayer(id);
  }

  // GET /enrollments/tournament/:id/category/:cat/count
  // Contar inscritos por categoría (valida mínimo 6 - Art. 23)
  @Get('tournament/:id/category/:cat/count')
  @UseGuards(JwtAuthGuard)
  countByCategory(
    @Param('id') id: string,
    @Param('cat') cat: string,
  ) {
    return this.enrollmentsService.countByCategory(id, cat);
  }
}