import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import * as bcrypt from 'bcrypt';

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private usersService: UsersService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  search(@Query('q') q: string) {
    return this.usersService.search(q || '');
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() body: Partial<User>) {
    return this.usersService.update(id, body);
  }

  // Desactivar jugador (soft delete)
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // Eliminar jugador permanentemente
  @Delete(':id/hard')
  @UseGuards(JwtAuthGuard)
  hardDelete(@Param('id') id: string) {
    return this.usersService.hardDelete(id);
  }

  @Post('import-csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No se recibió archivo');
    const content = file.buffer.toString('utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    const headers = lines[0].split(',').map((h) => h.trim());
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      try {
        const exists = await this.userRepo.findOne({
          where: [{ email: row.email }, { docNumber: row.docNumber }],
        });
        if (exists) {
          results.skipped++;
          continue;
        }

        const passBase = (row.apellidos || 'user').slice(0, 4).toLowerCase();
        const passDoc = (row.docNumber || '0000').slice(-4);
        const hashed = await bcrypt.hash(`${passBase}${passDoc}`, 12);

        await this.userRepo.save(
          this.userRepo.create({
            email: row.email,
            password: hashed,
            role: 'player' as any,
            nombres: row.nombres,
            apellidos: row.apellidos,
            telefono: row.telefono,
            direccion: row.direccion,
            docNumber: row.docNumber,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            gender: row.gender || 'M',
            mustChangePassword: true,
            isActive: true,
          }),
        );
        results.created++;
      } catch (err) {
        results.errors.push(`Línea ${i + 1}: ${err.message}`);
      }
    }
    return { message: 'Importación completada', ...results };
  }

  // PATCH /users/:id/role — cambiar rol
  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  changeRole(@Param('id') id: string, @Body() body: { role: string }) {
    return this.usersService.changeRole(id, body.role);
  }

  // GET /users/:id/assignments — torneos asignados al árbitro
  @Get(':id/assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getAssignments(@Param('id') id: string) {
    return this.usersService.getRefereeAssignments(id);
  }

  // POST /users/:id/assignments — asignar torneo
  @Post(':id/assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  assignTournament(
    @Param('id') id: string,
    @Body() body: { tournamentId: string },
  ) {
    return this.usersService.assignTournament(id, body.tournamentId);
  }

  // DELETE /users/:id/assignments/:tournamentId — quitar asignación
  @Delete(':id/assignments/:tournamentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  removeAssignment(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.usersService.removeAssignment(id, tournamentId);
  }
}
