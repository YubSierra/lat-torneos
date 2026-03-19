import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CircuitLine,
  CircuitRankingPoints,
  DEFAULT_LAT_RANKING_POINTS,
} from './circuit-line.entity';

const DEFAULT_LINES: { slug: string; label: string }[] = [
  { slug: 'departamental',  label: 'Departamental'  },
  { slug: 'inter_escuelas', label: 'Inter Escuelas' },
  { slug: 'infantil',       label: 'Infantil'       },
  { slug: 'senior',         label: 'Senior'         },
  { slug: 'edades_fct',     label: 'Edades FCT'     },
  { slug: 'recreativo',     label: 'Recreativo'     },
];

@Injectable()
export class CircuitLinesService implements OnModuleInit {
  constructor(
    @InjectRepository(CircuitLine)
    private repo: Repository<CircuitLine>,
  ) {}

  /** Seed default LAT circuit lines on startup */
  async onModuleInit() {
    // If the tournaments table still has an enum type for circuitLine,
    // TypeORM synchronize may fail. Run a safe ALTER to convert it first.
    try {
      await this.repo.manager.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tournaments'
              AND column_name = 'circuitLine'
              AND data_type = 'USER-DEFINED'
          ) THEN
            ALTER TABLE tournaments
              ALTER COLUMN "circuitLine" TYPE varchar
              USING "circuitLine"::varchar;
          END IF;
        END
        $$;
      `);
    } catch (_) {
      // Already varchar — nothing to do
    }

    for (const { slug, label } of DEFAULT_LINES) {
      const exists = await this.repo.findOne({ where: { slug } });
      if (!exists) {
        await this.repo.save(
          this.repo.create({
            slug,
            label,
            isDefault: true,
            rankingPoints: DEFAULT_LAT_RANKING_POINTS,
          }),
        );
      }
    }
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async findBySlug(slug: string): Promise<CircuitLine | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async create(dto: { slug: string; label: string; rankingPoints?: CircuitRankingPoints }) {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException(`Ya existe una línea con slug "${dto.slug}"`);
    const line = this.repo.create({
      ...dto,
      isDefault: false,
      rankingPoints: dto.rankingPoints ?? DEFAULT_LAT_RANKING_POINTS,
    });
    return this.repo.save(line);
  }

  async update(id: string, dto: { label?: string; rankingPoints?: CircuitRankingPoints }) {
    const line = await this.repo.findOne({ where: { id } });
    if (!line) throw new NotFoundException('Línea de circuito no encontrada');
    Object.assign(line, dto);
    return this.repo.save(line);
  }

  async remove(id: string) {
    const line = await this.repo.findOne({ where: { id } });
    if (!line) throw new NotFoundException('Línea de circuito no encontrada');
    if (line.isDefault)
      throw new BadRequestException('No se puede eliminar una línea de circuito predeterminada');
    await this.repo.remove(line);
    return { message: 'Línea eliminada correctamente' };
  }

  async addCategory(slug: string, category: string) {
    const line = await this.repo.findOne({ where: { slug } });
    if (!line) throw new NotFoundException('Línea de circuito no encontrada');
    const cats: string[] = Array.isArray(line.customCategories) ? line.customCategories : [];
    if (!cats.includes(category)) {
      line.customCategories = [...cats, category];
      await this.repo.save(line);
    }
    return line;
  }

  async removeCategory(slug: string, category: string) {
    const line = await this.repo.findOne({ where: { slug } });
    if (!line) throw new NotFoundException('Línea de circuito no encontrada');
    line.customCategories = (line.customCategories || []).filter(c => c !== category);
    await this.repo.save(line);
    return line;
  }
}
