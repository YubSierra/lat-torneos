import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RefereeAssignment } from './referee-assignment.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RefereeAssignment)
    private assignmentRepo: Repository<RefereeAssignment>,
  ) {}

  async findAll() {
    return this.userRepo.find({ order: { apellidos: 'ASC' } });
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Jugador no encontrado');
    return user;
  }

  async update(id: string, data: Partial<User>) {
    const user = await this.findOne(id);
    Object.assign(user, data);
    return this.userRepo.save(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    // Desactivar en vez de borrar para preservar historial
    user.isActive = false;
    await this.userRepo.save(user);
    return { message: 'Jugador desactivado correctamente' };
  }

  async hardDelete(id: string) {
    const user = await this.findOne(id);
    // Borrar inscripciones y partidos relacionados
    await this.userRepo.manager.query(
      'DELETE FROM enrollments WHERE "playerId" = $1',
      [id],
    );
    await this.userRepo.manager.query(
      'UPDATE matches SET "player1Id" = NULL WHERE "player1Id" = $1',
      [id],
    );
    await this.userRepo.manager.query(
      'UPDATE matches SET "player2Id" = NULL WHERE "player2Id" = $1',
      [id],
    );
    await this.userRepo.remove(user);
    return { message: 'Jugador eliminado permanentemente' };
  }

  async search(query: string) {
    return this.userRepo
      .createQueryBuilder('u')
      .where(
        'u.nombres ILIKE :q OR u.apellidos ILIKE :q OR u.email ILIKE :q',
        { q: `%${query}%` },
      )
      .andWhere('u.isActive = true')
      .limit(20)
      .getMany();
  }

  // ── CAMBIAR ROL DE USUARIO ───────────────────────
  async changeRole(id: string, newRole: string) {
    const user = await this.findOne(id);
    user.role = newRole as any;
    return this.userRepo.save(user);
  }

  // ── OBTENER TORNEOS ASIGNADOS A ÁRBITRO ──────────
  async getRefereeAssignments(refereeId: string) {
    return this.assignmentRepo.find({ where: { refereeId } });
  }

  // ── ASIGNAR TORNEO A ÁRBITRO ─────────────────────
  async assignTournament(refereeId: string, tournamentId: string) {
    // Evitar duplicados
    const exists = await this.assignmentRepo.findOne({
      where: { refereeId, tournamentId },
    });
    if (exists) return exists;

    const assignment = this.assignmentRepo.create({ refereeId, tournamentId });
    return this.assignmentRepo.save(assignment);
  }

  // ── QUITAR TORNEO DE ÁRBITRO ─────────────────────
  async removeAssignment(refereeId: string, tournamentId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { refereeId, tournamentId },
    });
    if (!assignment) return { message: 'Asignación no encontrada' };
    await this.assignmentRepo.remove(assignment);
    return { message: 'Torneo desasignado correctamente' };
  }
}
