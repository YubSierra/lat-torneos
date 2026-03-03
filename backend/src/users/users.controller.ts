import { Controller, Get, Post, Body,
         UseGuards, UploadedFile,
         UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import * as bcrypt from 'bcrypt';

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // GET /users — listar todos los usuarios (solo admins)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll() {
    return this.userRepo.find({
      select: [
        'id', 'email', 'role', 'isActive', 'createdAt',
        'nombres', 'apellidos', 'telefono', 'docNumber',
        'direccion', 'gender', 'birthDate',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // POST /users/import-csv — importar jugadores desde CSV
  @Post('import-csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No se recibió archivo');

    const content = file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      try {
        // Verificar si el usuario ya existe por email o documento
        const exists = await this.userRepo.findOne({
          where: [
            { email: row.email },
            { docNumber: row.docNumber },
          ],
        });

        if (exists) {
          results.skipped++;
          results.errors.push(`Línea ${i + 1}: ${row.email} ya existe`);
          continue;
        }

        // Generar contraseña temporal: primeras 4 letras del apellido + doc últimos 4
        const passBase = (row.apellidos || 'user').slice(0, 4).toLowerCase();
        const passDoc  = (row.docNumber || '0000').slice(-4);
        const tempPassword = `${passBase}${passDoc}`;
        const hashed = await bcrypt.hash(tempPassword, 12);

        // Crear usuario con todos los datos
        const user = this.userRepo.create({
          email:              row.email,
          password:           hashed,
          role:               'player' as any,
          nombres:            row.nombres,
          apellidos:          row.apellidos,
          telefono:           row.telefono,
          direccion:          row.direccion,
          docNumber:          row.docNumber,
          birthDate:          row.birthDate ? new Date(row.birthDate) : null,
          gender:             row.gender || 'M',
          mustChangePassword: true,
          isActive:           true,
        });

        await this.userRepo.save(user);
        results.created++;

      } catch (err) {
        results.errors.push(`Línea ${i + 1}: ${err.message}`);
      }
    }

    return {
      message: `Importación completada`,
      created: results.created,
      skipped: results.skipped,
      errors:  results.errors,
    };
  }
}
