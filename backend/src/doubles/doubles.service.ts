import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoublesTeam, DoublesTeamStatus } from './doubles-team.entity';
import { Enrollment, EnrollmentStatus } from '../enrollments/enrollment.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { User } from '../users/user.entity';

// Orden de categorías para determinar la más alta
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

  // ── OBTENER CATEGORÍA MÁS ALTA ──────────────────
  private getHigherCategory(cat1: string, cat2: string): string {
    const idx1 = CATEGORY_ORDER.indexOf(cat1);
    const idx2 = CATEGORY_ORDER.indexOf(cat2);
    if (idx1 === -1) return cat2;
    if (idx2 === -1) return cat1;
    return idx1 <= idx2 ? cat1 : cat2;
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

    // Verificar que no exista ya una pareja con estos jugadores
    const existing = await this.teamRepo.findOne({
      where: [
        { tournamentId, player1Id },
        { tournamentId, player2Id: player1Id },
      ],
    });
    if (existing) throw new BadRequestException('Este jugador ya tiene una pareja en este torneo');

    // Verificar inscripciones en singles
    const p1Singles = await this.enrollmentRepo.findOne({
      where: { tournamentId, playerId: player1Id, status: EnrollmentStatus.APPROVED },
    });
    const p2Singles = player2Id
      ? await this.enrollmentRepo.findOne({
          where: { tournamentId, playerId: player2Id, status: EnrollmentStatus.APPROVED },
        })
      : null;

    // Determinar categoría: la más alta de los dos
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

    // Calcular monto a cobrar
    let amountCharged = 0;
    const bothSingles = !!p1Singles && !!p2Singles;

    if (tournament.doublesIncludedForSingles && bothSingles) {
      amountCharged = 0; // Incluido
    } else if (tournament.doublesIncludedForSingles) {
      // Solo uno juega singles — el otro paga valor adicional
      amountCharged = Number(tournament.doublesAdditionalValue || tournament.doublesValue || 0);
    } else {
      // Ambos pagan
      amountCharged = Number(tournament.doublesValue || 0);
    }

    const team = this.teamRepo.create({
      tournamentId,
      player1Id,
      player2Id: player2Id || null,
      category: finalCategory,
      player1HasSingles: !!p1Singles,
      player2HasSingles: !!p2Singles,
      amountCharged,
      teamName: teamName || null,
      status: player2Id ? DoublesTeamStatus.PENDING : DoublesTeamStatus.PENDING,
      paymentStatus: amountCharged === 0 ? 'approved' : 'pending',
    });

    return this.teamRepo.save(team);
  }

  // ── EMPAREJAR (admin) ───────────────────────────
  async pairPlayers(
    teamId: string,
    player2Id: string,
  ) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Pareja no encontrada');
    if (team.player2Id) throw new BadRequestException('Esta pareja ya tiene compañero');

    const tournament = await this.tournamentRepo.findOne({ where: { id: team.tournamentId } });

    // Verificar singles del jugador 2
    const p2Singles = await this.enrollmentRepo.findOne({
      where: { tournamentId: team.tournamentId, playerId: player2Id, status: EnrollmentStatus.APPROVED },
    });

    // Actualizar categoría si es necesario
    if (p2Singles?.category) {
      team.category = this.getHigherCategory(team.category, p2Singles.category);
    }

    team.player2Id         = player2Id;
    team.player2HasSingles = !!p2Singles;

    // Recalcular monto
    const bothSingles = team.player1HasSingles && team.player2HasSingles;
    if (tournament.doublesIncludedForSingles && bothSingles) {
      team.amountCharged = 0;
      team.paymentStatus = 'approved';
    } else {
      team.amountCharged = Number(
        tournament.doublesIncludedForSingles
          ? tournament.doublesAdditionalValue
          : tournament.doublesValue
      ) || 0;
      team.paymentStatus = team.amountCharged === 0 ? 'approved' : 'pending';
    }

    return this.teamRepo.save(team);
  }

  // ── APROBAR PAGO MANUAL ─────────────────────────
  async approvePayment(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Pareja no encontrada');
    team.paymentStatus = 'manual';
    team.status        = DoublesTeamStatus.APPROVED;
    return this.teamRepo.save(team);
  }

  // ── LISTAR PAREJAS DE UN TORNEO ─────────────────
  async getTeamsByTournament(tournamentId: string) {
    const teams = await this.teamRepo.find({
      where: { tournamentId },
      order: { createdAt: 'ASC' },
    });

    // Enriquecer con nombres
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
      player2Name: t.player2Id ? userMap.get(t.player2Id) || t.player2Id : 'Sin compañero',
      amountFormatted: new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0,
      }).format(Number(t.amountCharged) || 0),
    }));
  }

  // ── JUGADORES SIN COMPAÑERO ─────────────────────
  async getUnpairedPlayers(tournamentId: string) {
    const teams = await this.teamRepo.find({ where: { tournamentId } });
    const pairedIds = new Set([
      ...teams.map(t => t.player1Id),
      ...teams.filter(t => t.player2Id).map(t => t.player2Id),
    ]);

    const enrollments = await this.enrollmentRepo.find({
      where: { tournamentId, status: EnrollmentStatus.APPROVED },
    });

    const unpaired = enrollments.filter(e => !pairedIds.has(e.playerId));

    if (unpaired.length === 0) return [];

    const users = await this.userRepo
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: unpaired.map(e => e.playerId) })
      .getMany();

    const userMap = new Map(
      users.map(u => [u.id, `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.email])
    );

    return unpaired.map(e => ({
      playerId: e.playerId,
      playerName: userMap.get(e.playerId) || e.playerId,
      category: e.category,
    }));
  }
}
