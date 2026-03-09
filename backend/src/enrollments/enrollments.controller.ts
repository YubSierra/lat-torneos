import { Controller, Get, Post, Patch, Delete, Body,
         Param, UseGuards, UploadedFile,
         UseInterceptors, Request } from '@nestjs/common';
import { FileInterceptor }          from '@nestjs/platform-express';
import { InjectRepository }         from '@nestjs/typeorm';
import { Repository }               from 'typeorm';
import { EnrollmentsService }       from './enrollments.service';
import { CreateEnrollmentDto }      from './dto/create-enrollment.dto';
import { JwtAuthGuard }             from '../auth/jwt.guard';
import { RolesGuard }               from '../auth/roles.guard';
import { User }                     from '../users/user.entity';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private enrollmentsService: EnrollmentsService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // POST /enrollments
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  // POST /enrollments/import-csv/:tournamentId
  @Post('import-csv/:tournamentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @Param('tournamentId') tournamentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('paymentMethod') paymentMethod: string,
  ) {
    if (!file) throw new Error('No se recibió archivo CSV');
    const content = file.buffer.toString('utf-8');
    const lines   = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const rows    = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      return row;
    });
    return this.enrollmentsService.importFromCsv(
      tournamentId, rows, this.userRepo, paymentMethod || 'manual',
    );
  }

  // POST /enrollments/enroll-single/:tournamentId
  @Post('enroll-single/:tournamentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async enrollSinglePlayer(
    @Param('tournamentId') tournamentId: string,
    @Body() body: {
      nombres: string; apellidos: string; email: string;
      telefono?: string; docNumber?: string;
      category: string; modality?: string; seeding?: number;
      paymentMethod?: string;
      adminNotes?: string;
    },
  ) {
    return this.enrollmentsService.enrollSinglePlayer(tournamentId, body);
  }

  // PATCH /enrollments/:id/payment-method
  @Patch(':id/payment-method')
  @UseGuards(JwtAuthGuard, RolesGuard)
  updatePaymentMethod(
    @Param('id') id: string,
    @Body() body: { paymentMethod: string; adminNotes?: string },
  ) {
    return this.enrollmentsService.updatePaymentMethod(
      id, body.paymentMethod, body.adminNotes,
    );
  }

  // GET /enrollments/my/pending
  @Get('my/pending')
  @UseGuards(JwtAuthGuard)
  getMyPending(@Request() req: any) {
    return this.enrollmentsService.findPendingByPlayer(req.user.sub);
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
