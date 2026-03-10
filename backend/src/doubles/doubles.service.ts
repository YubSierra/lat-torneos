import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoublesTeam, DoublesTeamStatus } from './doubles-team.entity';
import { Enrollment, EnrollmentStatus } from '../enrollments/enrollment.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { User } from '../users/user.entity';

const CATEGORY_ORDER = [
  'PRIMERA', 'SEGUNDA', 'INTERMEDIA', 'TERCERA',
  'CUARTA', 'QUINTA', 'SEXTA',
  '10 AÑOS', '12 AÑOS', '14 AÑOS', '16 AÑOS', '18 AÑOS',
];

@Injectable()
export class DoublesService {
  constructor(
    @InjectRepository(DoublesTeam)
    private teamRepo: Repository<DoublesTeam>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Tournament)
    private tournamentRepo: Repository<Tournament>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private getHigherCategory(cat1: string, cat2: string): string {
    const idx1 = CATEGORY_ORDER.indexOf(cat1);
    const idx2 = CATEGORY_ORDER.indexOf(cat2);
    if (idx1 === -1) return cat2;
    if (idx2 === -1) return cat1;
    return idx1 <= idx2 ? cat1 : cat2;
  }

  // ── CALCULAR MONTO POR JUGADOR INDIVIDUAL ───────
  // Lógica clara:
  //   - Jugador inscrito en singles + doublesIncludedForSingles=true  → $0
  //   - Jugador inscrito en singles + doublesIncludedForSingles=false → doublesAdditionalValue
  //   - Jugador SOLO en dobles (no juega singles)                     → doublesPlayerValue
  private calcPlayerAmount(hasSingles: boolean, tournament: Tournament): number {
    if (hasSingles) {
      return tournament.doublesIncludedForSingles
        ? 0
        : Number(tournament.doublesAdditionalValue || 0);
    }
    // No juega singles → paga su parte de dobles
    return Number(
      (tournament as any).doublesPlayerValue ||
      tournament.doublesValue ||
      0
    );
  }

  // ── CREAR/SOLICITAR PAREJA ──────────────────────
  async createTeam(
    tournamentId: string,
    player1Id: string,
    player2Id?: string,
    teamName?: string,
  ) {
    const tournament = await this.tournamentRepo.findOne({ where: { id: tournamentId } });
    if (!tournament) throw new BadRequestException('Torneo no encontrado');
    if (!tournament.hasDoubles) throw new BadRequestException('Este torneo no tiene modalidad de dobles');

    // Las inscripciones de dobles solo están abiertas mientras el admin
    // no haya cerrado el período (doublesOpenForRegistration = true)
    if (!(tournament as any).doublesOpenForRegistration) {
      throw new BadRequestException(
        'Las inscripciones de dobles están cerradas. ' +
          'El administrador debe habilitarlas desde la configuración del torneo.',
      );
    }

    const existing = await this.teamRepo.findOne({
      where: [
        { tournamentId, player1Id },
        { tournamentId, player2Id: player1Id },
      ],
    });
    if (existing) throw new BadRequestException('Este jugador ya tiene una pareja en este torneo');

    // Verificar inscripciones en singles de cada jugador
    const p1Singles = await this.enrollmentRepo.findOne({
      where: { tournamentId, playerId: player1Id, status: EnrollmentStatus.APPROVED },
    });
    const p2Singles = player2Id
      ? await this.enrollmentRepo.findOne({
          where: { tournamentId, playerId: player2Id, status: EnrollmentStatus.APPROVED },
        })
      : null;

    // Determinar categoría (la más alta entre los dos)
    const p1Category = p1Singles?.category || null;
    const p2Category = p2Singles?.category || null;
    let finalCategory: string;
    if (p1Category && p2Category) {
      finalCategory = this.getHigherCategory(p1Category, p2Category);
    } else if (p1Category) {
      finalCategory = p1Category;
    } else if (p2Category) {
      finalCategory = p2Category;
    } else {
      throw new BadRequestException('Al menos un jugador debe tener categoría definida');
    }

    // ── COBRO INDIVIDUAL POR JUGADOR ───────────────
    const p1Amount = this.calcPlayerAmount(!!p1Singles, tournament);
    const p2Amount = player2Id
      ? this.calcPlayerAmount(!!p2Singles, tournament)
      : 0;

    const team = this.teamRepo.create({
      tournamentId,
      player1Id,
      player2Id: player2Id || null,
      category: finalCategory,
      player1HasSingles: !!p1Singles,
      player2HasSingles: !!p2Singles,
      // Montos individuales
      player1AmountCharged: p1Amount,
      player2AmountCharged: p2Amount,
      amountCharged: p1Amount + p2Amount,           // total pareja
      // Estados de pago individuales
      player1PaymentStatus: p1Amount === 0 ? 'approved' : 'pending',
      player2PaymentStatus: p2Amount === 0 ? 'approved' : 'pending',
      paymentStatus: (p1Amount + p2Amount) === 0 ? 'approved' : 'pending',
      teamName: teamName || null,
      status: DoublesTeamStatus.PENDING,
    });

    return this.teamRepo.save(team);
  }

  // ── EMPAREJAR (admin asigna jugador 2) ──────────
  async pairPlayers(teamId: string, player2Id: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Pareja no encontrada');
    if (team.player2Id) throw new BadRequestException('Esta pareja ya tiene compañero');

    const tournament = await this.tournamentRepo.findOne({ where: { id: team.tournamentId } });

    const p2Singles = await this.enrollmentRepo.findOne({
      where: { tournamentId: team.tournamentId, playerId: player2Id, status: EnrollmentStatus.APPROVED },
    });

    if (p2Singles?.category) {
      team.category = this.getHigherCategory(team.category, p2Singles.category);
    }

    team.player2Id         = player2Id;
    team.player2HasSingles = !!p2Singles;

    // Recalcular monto jugador 2
    const p2Amount = this.calcPlayerAmount(!!p2Singles, tournament);
    team.player2AmountCharged = p2Amount;
    team.player2PaymentStatus = p2Amount === 0 ? 'approved' : 'pending';
    team.amountCharged = Number(team.player1AmountCharged || 0) + p2Amount;

    // Estado general de pago
    const allPaid =
      team.player1PaymentStatus !== 'pending' &&
      team.player2PaymentStatus !== 'pending';
    team.paymentStatus = allPaid ? 'manual' : 'pending';

    return this.teamRepo.save(team);
  }

  // ── APROBAR PAGO DE JUGADOR 1 ───────────────────
  async approvePlayer1Payment(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Pareja no encontrada');
    team.player1PaymentStatus = 'manual';

    // Si el jugador 2 también está listo → marcar equipo como aprobado
    if (team.player2PaymentStatus !== 'pending') {
      team.paymentStatus = 'manual';
      team.status = DoublesTeamStatus.APPROVED;
    }
    return this.teamRepo.save(team);
  }

  // ── APROBAR PAGO DE JUGADOR 2 ───────────────────
  async approvePlayer2Payment(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Pareja no encontrada');
    if (!team.player2Id) throw new BadRequestException('No hay jugador 2 en esta pareja');
    team.player2PaymentStatus = 'manual';

    if (team.player1PaymentStatus !== 'pending') {
      team.paymentStatus = 'manual';
      team.status = DoublesTeamStatus.APPROVED;
    }
    return this.teamRepo.save(team);
  }

  // ── APROBAR PAGO GLOBAL (compatibilidad) ────────
  async approvePayment(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Pareja no encontrada');
    team.player1PaymentStatus = 'manual';
    team.player2PaymentStatus = 'manual';
    team.paymentStatus        = 'manual';
    team.status               = DoublesTeamStatus.APPROVED;
    return this.teamRepo.save(team);
  }

  // ── LISTAR PAREJAS DEL TORNEO ───────────────────
  async getTeamsByTournament(tournamentId: string) {
    const teams = await this.teamRepo.find({
      where: { tournamentId },
      order: { createdAt: 'ASC' },
    });

    const playerIds = [...new Set([
      ...teams.map(t => t.player1Id),
      ...teams.map(t => t.player2Id),
    ].filter(Boolean))];

    const users = playerIds.length > 0
      ? await this.userRepo
          .createQueryBuilder('user')
          .where('user.id IN (:...ids)', { ids: playerIds })
          .getMany()
      : [];

    const userMap = new Map(
      users.map(u => [u.id, `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email])
    );

    return teams.map(t => ({
      ...t,
      player1Name: userMap.get(t.player1Id) || t.player1Id,
      player2Name: t.player2Id ? (userMap.get(t.player2Id) || t.player2Id) : null,
    }));
  }

  // ── JUGADORES SIN PAREJA ────────────────────────
  async getUnpairedPlayers(tournamentId: string) {
    const teams = await this.teamRepo.find({ where: { tournamentId } });
    const pairedIds = new Set([
      ...teams.map(t => t.player1Id),
      ...teams.filter(t => t.player2Id).map(t => t.player2Id),
    ]);

    const enrollments = await this.enrollmentRepo.find({
      where: { tournamentId, status: EnrollmentStatus.APPROVED },
    });

    const playerIds = [...new Set(enrollments.map(e => e.playerId))].filter(
      id => !pairedIds.has(id)
    );

    if (playerIds.length === 0) return [];

    const users = await this.userRepo
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: playerIds })
      .getMany();

    return users.map(u => ({
      id: u.id,
      name: `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email,
      email: u.email,
      category: enrollments.find(e => e.playerId === u.id)?.category || '',
    }));
  }
}
