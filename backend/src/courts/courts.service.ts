import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from './court.entity';
import { CreateCourtDto } from './dto/create-court.dto';

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private repo: Repository<Court>,
  ) {}

  // ── CREAR CANCHA ────────────────────────────────
  async create(dto: CreateCourtDto) {
    const court = this.repo.create(dto);
    return this.repo.save(court);
  }

  // ── LISTAR TODAS ────────────────────────────────
  async findAll() {
    return this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  // ── BUSCAR UNA ──────────────────────────────────
  async findOne(id: string) {
    const court = await this.repo.findOne({ where: { id } });
    if (!court) throw new NotFoundException('Cancha no encontrada');
    return court;
  }

  // ── ACTUALIZAR ──────────────────────────────────
  async update(id: string, dto: Partial<CreateCourtDto>) {
    const court = await this.findOne(id);
    Object.assign(court, dto);
    return this.repo.save(court);
  }

  // ── DESACTIVAR ──────────────────────────────────
  async deactivate(id: string) {
    const court = await this.findOne(id);
    court.isActive = false;
    return this.repo.save(court);
  }
}
