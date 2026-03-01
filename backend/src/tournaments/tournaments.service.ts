import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './tournament.entity'; // Asegúrate de que la entidad exista

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentRepo: Repository<Tournament>,
  ) {}

  // 1. Crear un nuevo torneo
  async create(tournamentData: Partial<Tournament>): Promise<Tournament> {
    const newTournament = this.tournamentRepo.create(tournamentData);
    return await this.tournamentRepo.save(newTournament);
  }

  // 2. Obtener todos los torneos
  async findAll(): Promise<Tournament[]> {
    return await this.tournamentRepo.find();
  }

  // 3. Obtener un torneo por ID
  async findOne(id: string): Promise<Tournament> { // Cambiado a string
    const tournament = await this.tournamentRepo.findOne({ where: { id } });
    if (!tournament) {
      throw new NotFoundException(`Torneo con ID ${id} no encontrado`);
    }
    return tournament;
  }

  // 4. Actualizar un torneo
  async update(id: string, updateData: Partial<Tournament>): Promise<Tournament> { // Cambiado a string
    const tournament = await this.findOne(id);
    const updated = Object.assign(tournament, updateData);
    return await this.tournamentRepo.save(updated);
  }

  // 5. Eliminar un torneo
  async remove(id: string): Promise<void> {
    const tournament = await this.findOne(id);
    await this.tournamentRepo.remove(tournament);
  }
}
