import { Injectable, BadRequestException,
         NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.repo.find({
      where: { tournamentId },
      order: { enrolledAt: 'ASC' },
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
}
