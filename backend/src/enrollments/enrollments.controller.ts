// backend/src/enrollments/enrollments.controller.ts  ← REEMPLAZA COMPLETO
import { Controller, Get, Post, Delete, Body,
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

// ── Parser CSV robusto (RFC 4180) ─────────────────────────────────────────────
// Maneja campos entre comillas con comas y saltos de línea adentro
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"')  { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n') {
        row.push(field.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = []; field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field || row.length > 0) {
    row.push(field.trim());
    if (row.some(c => c !== '')) rows.push(row);
  }

  return rows;
}

@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private enrollmentsService: EnrollmentsService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // POST /enrollments — inscribir jugador (admin)
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  // POST /enrollments/public/:tournamentId — sin auth (landing page)
  @Post('public/:tournamentId')
  async publicRegister(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      nombres: string; apellidos: string; email: string;
      telefono?: string; docNumber?: string; category: string;
    },
  ) {
    return this.enrollmentsService.publicRegister(tournamentId, body);
  }

  // POST /enrollments/import-csv/:tournamentId
  @Post('import-csv/:tournamentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @Param('tournamentId') tournamentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No se recibió archivo CSV');

    const content = file.buffer.toString('utf-8');
    const allRows = parseCSV(content);
    if (allRows.length < 2) throw new Error('CSV vacío o sin datos');

    const headers = allRows[0].map(h =>
      h.trim().toLowerCase().replace(/^\uFEFF/, '')
    );

    const rows = allRows.slice(1).map(values => {
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || ''; });
      return row;
    });

    return this.enrollmentsService.importFromCsv(tournamentId, rows, this.userRepo);
  }

  // POST /enrollments/enroll-single/:tournamentId
  @Post('enroll-single/:tournamentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async enrollSinglePlayer(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      nombres: string; apellidos: string; email: string;
      telefono?: string; docNumber?: string; category: string; modality?: string;
    },
  ) {
    return this.enrollmentsService.enrollSinglePlayer(tournamentId, body);
  }

  // GET /enrollments/tournament/:id
  @Get('tournament/:id')
  @UseGuards(JwtAuthGuard)
  findByTournament(@Param('id') id: string) {
    return this.enrollmentsService.findByTournament(id);
  }

  // GET /enrollments/player/:id
  @Get('player/:id')
  @UseGuards(JwtAuthGuard)
  findByPlayer(@Param('id') id: string) {
    return this.enrollmentsService.findByPlayer(id);
  }

  // GET /enrollments/tournament/:id/category/:cat/count
  @Get('tournament/:id/category/:cat/count')
  @UseGuards(JwtAuthGuard)
  countByCategory(@Param('id') id: string, @Param('cat') cat: string) {
    return this.enrollmentsService.countByCategory(id, cat);
  }

  // DELETE /enrollments/:id
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }
}