import { Controller, Get, Post, Body,
         Param, UseGuards, UploadedFile,
         UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../users/user.entity';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private enrollmentsService: EnrollmentsService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // POST /enrollments — inscribir jugador
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  // POST /enrollments/import-csv/:tournamentId
  // Importar jugadores desde CSV y crear inscripciones
  @Post('import-csv/:tournamentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @Param('tournamentId') tournamentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No se recibió archivo CSV');

    // Parsear el CSV
    const content = file.buffer.toString('utf-8');
    const lines   = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      return row;
    });

    return this.enrollmentsService.importFromCsv(
      tournamentId,
      rows,
      this.userRepo,
    );
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
  @Get('tournament/:id/category/:cat/count')
  @UseGuards(JwtAuthGuard)
  countByCategory(
    @Param('id') id: string,
    @Param('cat') cat: string,
  ) {
    return this.enrollmentsService.countByCategory(id, cat);
  }
}