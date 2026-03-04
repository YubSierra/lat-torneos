import { Injectable, BadRequestException,
         NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Enrollment, EnrollmentStatus } from './enrollment.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private repo: Repository<Enrollment>,
    private tournamentsService: TournamentsService,
  ) {}

  // ── CREAR INSCRIPCIÓN ───────────────────────────
  async create(dto: CreateEnrollmentDto) {
    // Verificar que el torneo existe
    const tournament = await this.tournamentsService.findOne(dto.tournamentId);

    // Verificar que el torneo está abierto
    if (tournament.status !== 'open') {
      throw new BadRequestException(
        'El torneo no está abierto para inscripciones',
      );
    }

    // Verificar que el jugador no esté ya inscrito
    const exists = await this.repo.findOne({
      where: {
        tournamentId: dto.tournamentId,
        playerId: dto.playerId,
        modality: dto.modality,
      },
    });
    if (exists) {
      throw new BadRequestException(
        'El jugador ya está inscrito en esta categoría y modalidad',
      );
    }

    // Crear la inscripción con estado pendiente
    const enrollment = this.repo.create({
      ...dto,
      status: EnrollmentStatus.PENDING,
    });

    return this.repo.save(enrollment);
  }

  // ── LISTAR POR TORNEO ───────────────────────────
  async findByTournament(tournamentId: string) {
    const enrollments = await this.repo.find({
      where: { tournamentId },
      order: { enrolledAt: 'ASC' },
    });

    if (enrollments.length === 0) return [];

    const playerIds = enrollments.map(e => e.playerId);

    const users = await this.repo.manager
      .getRepository('users')
      .find({ where: { id: In(playerIds) } });

    const userMap = new Map(
      users.map((u: any) => [
        u.id,
        `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
      ])
    );

    return enrollments.map(e => ({
      ...e,
      playerName: userMap.get(e.playerId) || e.playerId,
    }));
  }

  // ── LISTAR POR JUGADOR ──────────────────────────
  async findByPlayer(playerId: string) {
    return this.repo.find({
      where: { playerId },
      order: { enrolledAt: 'DESC' },
    });
  }

  // ── BUSCAR UNO ──────────────────────────────────
  async findOne(id: string) {
    const enrollment = await this.repo.findOne({ where: { id } });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');
    return enrollment;
  }

  // ── APROBAR INSCRIPCIÓN (llamado desde webhook MP) ──
  async approve(id: string, mpPaymentId: string) {
    const enrollment = await this.findOne(id);
    enrollment.status = EnrollmentStatus.APPROVED;
    enrollment.paymentId = mpPaymentId;
    return this.repo.save(enrollment);
  }

  // ── RECHAZAR INSCRIPCIÓN ────────────────────────
  async reject(id: string) {
    const enrollment = await this.findOne(id);
    enrollment.status = EnrollmentStatus.REJECTED;
    return this.repo.save(enrollment);
  }

  // ── CONTAR INSCRITOS POR CATEGORÍA ─────────────
  // Art. 23: mínimo 6 jugadores para que se realice la categoría
  async countByCategory(tournamentId: string, category: string) {
    return this.repo.count({
      where: {
        tournamentId,
        category,
        status: EnrollmentStatus.APPROVED,
      },
    });
  }
  // ── IMPORTAR DESDE CSV ──────────────────────────
  async importFromCsv(tournamentId: string, rows: any[], userRepo: any) {
    const bcrypt = require('bcrypt');
    const results = {
      created: 0,
      existing: 0,
      enrolled: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // ── 1. BUSCAR USUARIO EXISTENTE ─────────────
        let user = null;

        // Buscar por docNumber primero, luego por email
        if (row.docNumber?.trim()) {
          user = await userRepo.findOne({
            where: { docNumber: row.docNumber.trim() },
          });
        }
        if (!user && row.email?.trim()) {
          user = await userRepo.findOne({
            where: { email: row.email.trim() },
          });
        }

        // ── 2. CREAR USUARIO SI NO EXISTE ───────────
        if (!user) {
          // Verificar que tenga los datos mínimos para crearlo
          const required = ['nombres', 'apellidos', 'email', 'docNumber', 'telefono'];
          const missing = required.filter(f => !row[f]?.trim());

          if (missing.length > 0) {
            results.errors.push(
              `Fila ${i + 2}: Jugador no encontrado y faltan datos: ${missing.join(', ')}`
            );
            results.skipped++;
            continue;
          }

          // Generar contraseña temporal: 4 letras apellido + 4 últimos del doc
          const passBase = row.apellidos.slice(0, 4).toLowerCase();
          const passDoc  = row.docNumber.slice(-4);
          const hashed   = await bcrypt.hash(`${passBase}${passDoc}`, 12);

          user = await userRepo.save(userRepo.create({
            email:              row.email.trim(),
            password:           hashed,
            role:               'player',
            nombres:            row.nombres.trim(),
            apellidos:          row.apellidos.trim(),
            telefono:           row.telefono?.trim(),
            direccion:          row.direccion?.trim(),
            docNumber:          row.docNumber.trim(),
            birthDate:          row.birthDate?.trim() ? new Date(row.birthDate) : null,
            gender:             row.gender?.trim() || 'M',
            mustChangePassword: true,
            isActive:           true,
          }));
          results.created++;

        } else {
          results.existing++;
        }

        // ── 3. VERIFICAR INSCRIPCIÓN DUPLICADA ──────
        const exists = await this.repo.findOne({
          where: {
            tournamentId,
            playerId: user.id,
            category: row.category?.trim(),
          },
        });

        if (exists) {
          results.skipped++;
          results.errors.push(
            `Fila ${i + 2}: ${row.email || row.docNumber} ya inscrito en ${row.category}`
          );
          continue;
        }

        // ── 4. CREAR INSCRIPCIÓN APROBADA ───────────
        // status: approved porque el admin está confirmando la inscripción
        // paymentId: 'MANUAL' indica que el pago fue presencial
        const enrollment = this.repo.create({
          tournamentId,
          playerId:  user.id,
          modality:  (row.modality?.trim() || 'singles') as any,
          category:  row.category?.trim(),
          seeding:   row.seeding?.trim() ? Number(row.seeding) : null,
          status:    'approved' as any,
          paymentId: 'MANUAL',
        });

        await this.repo.save(enrollment);

        // ── 5. GUARDAR RANKING PREVIO SI VIENE ──────
        // Solo aplica si es primer torneo del año del circuito
        if (row.ranking?.trim()) {
          const rankingRepo = userRepo.manager.getRepository('rankings');
          const season = new Date().getFullYear();

          const existingRanking = await rankingRepo.findOne({
            where: {
              playerId: user.id,
              category: row.category?.trim(),
              season,
            },
          });

          if (!existingRanking) {
            await rankingRepo.save({
              playerId:          user.id,
              category:          row.category?.trim(),
              circuitLine:       'departamental',
              totalPoints:       Number(row.ranking),
              meritPoints:       0,
              tournamentsPlayed: 0,
              position:          0,
              season,
            });
          }
        }

        results.enrolled++;

      } catch (err) {
        results.errors.push(`Fila ${i + 2}: ${err.message}`);
      }
    }

    return {
      message: 'Importación completada',
      ...results,
    };
  }
}
