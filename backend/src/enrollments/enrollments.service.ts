import { Injectable, BadRequestException,
         NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Enrollment, EnrollmentStatus } from './enrollment.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { TournamentsService } from '../tournaments/tournaments.service';
import { formatPlayerName } from '../common/name-format.util';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private repo: Repository<Enrollment>,
    private tournamentsService: TournamentsService,
  ) {}

  // ── UNIFICAR CATEGORÍAS ──────────────────────────────────────────────────────
  // Mueve todas las inscripciones de `from` → `to` y actualiza tournament.categories.
  // Requiere que no existan partidos generados para la categoría origen.
  async mergeCategories(tournamentId: string, from: string, to: string) {
    const tournament = await this.tournamentsService.findOne(tournamentId);

    // Verificar que ambas categorías existen en el torneo
    const cats: any[] = tournament.categories || [];
    const toCatExists = cats.some((c: any) => (typeof c === 'string' ? c : c.name) === to);
    if (!toCatExists) throw new BadRequestException(`La categoría destino "${to}" no existe en el torneo`);

    // Verificar que no haya partidos generados para la categoría origen
    const matchCount: number = await this.repo.manager
      .getRepository('matches')
      .count({ where: { tournamentId, category: from } });
    if (matchCount > 0) {
      throw new BadRequestException(
        `La categoría "${from}" ya tiene ${matchCount} partido(s) generado(s). Elimina el cuadro antes de unificar.`,
      );
    }

    // Mover inscripciones
    const updated = await this.repo.update({ tournamentId, category: from }, { category: to });

    // Quitar la categoría origen de tournament.categories
    const newCats = cats.filter((c: any) => (typeof c === 'string' ? c : c.name) !== from);
    await this.tournamentsService.update(tournamentId, { categories: newCats } as any);

    return {
      moved: updated.affected ?? 0,
      from,
      to,
      message: `${updated.affected ?? 0} inscripciones movidas de "${from}" a "${to}"`,
    };
  }

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
      users.map((u: any) => [u.id, u])
    );

    return enrollments.map(e => {
      const u = userMap.get(e.playerId) as any;
      return {
        ...e,
        playerName:      u ? formatPlayerName(u.nombres, u.apellidos, u.email) : e.playerId,
        playerEmail:     u?.email     || null,
        playerPhone:     u?.telefono  || null,
        playerDocNumber: u?.docNumber || null,
      };
    });
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
  async importFromCsv(tournamentId: string, rows: any[], userRepo: any, paymentMethod: string = 'manual') {
    const bcrypt = require('bcrypt');
    const results = {
      created: 0,
      existing: 0,
      enrolled: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const isReserved  = paymentMethod === 'reserved';
    const enrollStatus = isReserved ? 'reserved' : 'approved';
    const paymentId    = isReserved ? 'RESERVED' : paymentMethod.toUpperCase();

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
          // Verificar datos mínimos para crear el usuario
          const required = ['nombres', 'apellidos', 'email', 'docNumber', 'telefono'];
          const missing = required.filter(f => !row[f]?.trim());

          if (missing.length > 0) {
            results.errors.push(
              `Fila ${i + 2}: Jugador no encontrado y faltan datos: ${missing.join(', ')}`
            );
            results.skipped++;
            continue;
          }

          // Contraseña temporal: 4 letras apellido + 4 últimos del documento
          const passBase = row.apellidos.slice(0, 4).toLowerCase();
          const passDoc  = row.docNumber.slice(-4);
          const hashed   = await bcrypt.hash(`${passBase}${passDoc}`, 12);

          user = await userRepo.save(userRepo.create({
            email:              row.email.trim(),
            password:           hashed,
            role:               'player',
            nombres:            row.nombres.trim(),
            apellidos:          row.apellidos.trim(),
            telefono:           row.telefono.trim(),
            direccion:          row.direccion?.trim() || null,
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

        // ── 3. RESOLVER CATEGORÍA (base + género de categoría) ──────────
        const catBase   = row.category?.trim() || '';
        const catGender = row.categoryGender?.trim().toUpperCase();
        const fullCategory = catGender ? `${catBase} ${catGender}` : catBase;

        // ── 4. VERIFICAR INSCRIPCIÓN DUPLICADA ──────
        const exists = await this.repo.findOne({
          where: {
            tournamentId,
            playerId: user.id,
            category: fullCategory,
          },
        });

        if (exists) {
          results.skipped++;
          results.errors.push(
            `Fila ${i + 2}: ${row.email || row.docNumber} ya inscrito en ${fullCategory}`
          );
          continue;
        }

        // ── 5. CREAR INSCRIPCIÓN ─────────────────────
        const enrollment = this.repo.create({
          tournamentId,
          playerId:      user.id,
          modality:      (row.modality?.trim() || 'singles') as any,
          category:      fullCategory,
          seeding:       row.seeding?.trim() ? Number(row.seeding) : null,
          status:        enrollStatus as any,
          paymentMethod: paymentMethod as any,
          paymentId:     paymentId,
          adminNotes:    row.adminNotes?.trim() || null,
        });

        await this.repo.save(enrollment);

        // ── 6. GUARDAR RANKING PREVIO SI VIENE ──────
        // Solo aplica si es primer torneo del año del circuito
        if (row.ranking?.trim()) {
          const rankingRepo = userRepo.manager.getRepository('rankings');
          const season = new Date().getFullYear();

          const existingRanking = await rankingRepo.findOne({
            where: {
              playerId: user.id,
              category: fullCategory,
              season,
            },
          });

          if (!existingRanking) {
            await rankingRepo.save({
              playerId:          user.id,
              category:          fullCategory,
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
      paymentMethod,
      isReserved,
      ...results,
    };
  }

  // ── INSCRIBIR JUGADOR INDIVIDUAL ────────────────
  async enrollSinglePlayer(
    tournamentId: string,
    data: {
      nombres: string;
      apellidos: string;
      email: string;
      telefono?: string;
      docNumber?: string;
      category: string;
      modality?: string;
      seeding?: number;
      paymentMethod?: string;
      adminNotes?: string;
    },
  ) {
    const userRepo = this.repo.manager.getRepository('users');
    const bcrypt   = require('bcrypt');

    // 1. Buscar usuario existente
    let user: any = null;
    if (data.docNumber) {
      user = await userRepo.findOne({ where: { docNumber: data.docNumber } });
    }
    if (!user && data.email) {
      user = await userRepo.findOne({ where: { email: data.email } });
    }

    // 2. Crear usuario si no existe; si existe, actualizar datos faltantes
    if (!user) {
      const tempPass = `${data.apellidos.slice(0, 4).toLowerCase()}${(data.docNumber || '0000').slice(-4)}`;
      const hashed   = await bcrypt.hash(tempPass, 10);
      user = await userRepo.save(userRepo.create({
        nombres: data.nombres, apellidos: data.apellidos,
        email: data.email, telefono: data.telefono || '',
        docNumber: data.docNumber || null,
        password: hashed, mustChangePassword: true,
        role: 'player', isActive: true,
      }));
    } else {
      // Si el usuario existe pero tiene nombre vacío, actualizarlo con los datos del formulario
      const needsUpdate =
        (!user.nombres?.trim() && data.nombres?.trim()) ||
        (!user.apellidos?.trim() && data.apellidos?.trim()) ||
        (!user.telefono?.trim() && data.telefono?.trim()) ||
        (!user.docNumber?.trim() && data.docNumber?.trim());

      if (needsUpdate) {
        await userRepo.update(user.id, {
          nombres:   user.nombres?.trim()   || data.nombres   || user.nombres,
          apellidos: user.apellidos?.trim() || data.apellidos || user.apellidos,
          telefono:  user.telefono?.trim()  || data.telefono  || user.telefono,
          docNumber: user.docNumber?.trim() || data.docNumber || user.docNumber,
        });
        user = await userRepo.findOne({ where: { id: user.id } });
      }
    }

    // 3. Verificar duplicado
    const existing = await this.repo.findOne({
      where: { tournamentId, playerId: user.id, category: data.category },
    });
    if (existing) {
      throw new Error(`${data.nombres} ${data.apellidos} ya está inscrito en esta categoría`);
    }

    // 4. Determinar status según paymentMethod
    const pm         = (data.paymentMethod || 'manual') as string;
    const isReserved = pm === 'reserved';

    const enrollment = this.repo.create({
      tournamentId,
      playerId:      user.id,
      category:      data.category,
      modality:      (data.modality || 'singles') as any,
      seeding:       data.seeding || null,
      status:        (isReserved ? EnrollmentStatus.RESERVED : EnrollmentStatus.APPROVED) as any,
      paymentMethod: pm as any,
      paymentId:     isReserved ? 'RESERVED' : pm.toUpperCase(),
      adminNotes:    data.adminNotes || null,
    });
    await this.repo.save(enrollment);

    return {
      success:       true,
      userId:        user.id,
      playerName:    formatPlayerName(user.nombres, user.apellidos),
      category:      data.category,
      status:        enrollment.status,
      paymentMethod: pm,
      message:       isReserved
        ? 'Jugador guardado como RESERVADO. Pago pendiente de confirmación.'
        : 'Jugador inscrito exitosamente.',
    };
  }

  // ── CAMBIAR FORMA DE PAGO / CONFIRMAR PAGO ───────
  async updatePaymentMethod(
    enrollmentId: string,
    paymentMethod: string,
    adminNotes?: string,
  ) {
    const enrollment = await this.repo.findOne({ where: { id: enrollmentId } });
    if (!enrollment) throw new Error('Inscripción no encontrada');

    const isReserved = paymentMethod === 'reserved';

    enrollment.paymentMethod = paymentMethod as any;
    enrollment.paymentId     = isReserved ? 'RESERVED' : paymentMethod.toUpperCase();
    enrollment.status        = isReserved
      ? EnrollmentStatus.RESERVED
      : EnrollmentStatus.APPROVED;

    if (adminNotes !== undefined) enrollment.adminNotes = adminNotes;

    await this.repo.save(enrollment);
    return { success: true, enrollment };
  }

  // ── INSCRIPCIONES PENDIENTES DE UN JUGADOR ───────
  async findPendingByPlayer(playerId: string) {
    const enrollments = await this.repo.find({
      where: [
        { playerId, status: EnrollmentStatus.RESERVED },
        { playerId, status: EnrollmentStatus.PENDING  },
      ],
      order: { enrolledAt: 'DESC' },
    });

    const tournamentRepo = this.repo.manager.getRepository('tournaments');
    const result = [];
    for (const e of enrollments) {
      const tournament = await tournamentRepo.findOne({ where: { id: e.tournamentId } });
      result.push({
        ...e,
        tournamentName:   tournament?.name || '—',
        tournamentStart:  tournament?.eventStart || null,
        inscriptionValue: tournament?.inscriptionValue || 0,
      });
    }
    return result;
  }

  // ── CAMBIAR CATEGORÍA DE INSCRIPCIÓN ────────────
  async changeEnrollmentCategory(enrollmentId: string, newCategory: string) {
    const enrollment = await this.repo.findOne({ where: { id: enrollmentId } });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

    const matchCount: number = await this.repo.manager
      .getRepository('matches')
      .count({ where: { tournamentId: enrollment.tournamentId, category: enrollment.category } });
    if (matchCount > 0) {
      throw new BadRequestException(
        'Esta categoría ya tiene cuadros generados. Elimina el cuadro antes de cambiar.',
      );
    }

    enrollment.category = newCategory;
    return this.repo.save(enrollment);
  }

  // ── ELIMINAR INSCRIPCIÓN ─────────────────────────
  async remove(id: string) {
    const enrollment = await this.repo.findOne({ where: { id } });
    if (!enrollment) throw new Error('Inscripción no encontrada');
    await this.repo.remove(enrollment);
    return { message: 'Inscripción eliminada correctamente' };
  }
  // ── REGISTRO PÚBLICO DESDE LANDING ─────────────
  // Sin JWT — cualquier persona puede pre-registrarse
  // Crea cuenta con contraseña temporal si no existe
  // Deja la inscripción en PENDING hasta confirmar pago
  async publicRegister(
    tournamentId: string,
    data: {
      nombres: string;
      apellidos: string;
      email: string;
      telefono?: string;
      docNumber?: string;
      category: string;
    },
  ) {
    const userRepo = this.repo.manager.getRepository('users');
    const bcrypt = require('bcrypt');

    // 1. Verificar que el torneo existe y acepta inscripciones
    const tournament = await this.repo.manager
      .getRepository('tournaments')
      .findOne({ where: { id: tournamentId } });

    if (!tournament) {
      throw new Error('Torneo no encontrado');
    }
    if (tournament.status !== 'open') {
      throw new Error('Este torneo no está abierto para inscripciones');
    }

    // 2. Buscar o crear usuario
    let user: any = null;
    if (data.docNumber?.trim()) {
      user = await userRepo.findOne({ where: { docNumber: data.docNumber.trim() } });
    }
    if (!user && data.email?.trim()) {
      user = await userRepo.findOne({ where: { email: data.email.trim() } });
    }

    if (!user) {
      const pass = `${(data.apellidos || 'lat').slice(0, 4).toLowerCase()}${(data.docNumber || '0000').slice(-4)}`;
      const hashed = await bcrypt.hash(pass, 10);
      user = await userRepo.save(userRepo.create({
        nombres:            data.nombres,
        apellidos:          data.apellidos,
        email:              data.email,
        telefono:           data.telefono || '',
        docNumber:          data.docNumber || null,
        password:           hashed,
        mustChangePassword: true,
        role:               'player',
        isActive:           true,
      }));
    }

    // 3. Verificar inscripción duplicada
    const existing = await this.repo.findOne({
      where: { tournamentId, playerId: user.id, category: data.category },
    });
    if (existing) {
      throw new Error(`Ya existe una inscripción para ${data.email} en categoría ${data.category}`);
    }

    // 4. Crear inscripción PENDING (requiere confirmación de pago)
    const enrollment = this.repo.create({
      tournamentId,
      playerId:  user.id,
      category:  data.category,
      modality:  'singles' as any,
      status:    EnrollmentStatus.PENDING,
    });
    await this.repo.save(enrollment);

    return {
      success: true,
      message: 'Pre-inscripción exitosa. Un administrador confirmará tu inscripción.',
      playerName: formatPlayerName(user.nombres, user.apellidos),
      category: data.category,
      tempPassword: `Tu contraseña temporal es: ${(data.apellidos || 'lat').slice(0,4).toLowerCase()}${(data.docNumber || '0000').slice(-4)}`,
    };
  }
}
