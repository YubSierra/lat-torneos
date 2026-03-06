import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
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
      'DELETE FROM enrollments WHERE "playerId" = $1', [id]
    );
    await this.userRepo.manager.query(
      'UPDATE matches SET "player1Id" = NULL WHERE "player1Id" = $1', [id]
    );
    await this.userRepo.manager.query(
      'UPDATE matches SET "player2Id" = NULL WHERE "player2Id" = $1', [id]
    );
    await this.userRepo.remove(user);
    return { message: 'Jugador eliminado permanentemente' };
  }

  async search(query: string) {
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.nombres ILIKE :q OR u.apellidos ILIKE :q OR u.email ILIKE :q', { q: `%${query}%` })
      .andWhere('u.isActive = true')
      .limit(20)
      .getMany();
  }
}
