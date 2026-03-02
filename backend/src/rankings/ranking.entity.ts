import { Entity, PrimaryGeneratedColumn, Column,
         UpdateDateColumn } from 'typeorm';

@Entity('rankings')
export class Ranking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  playerId: string;

  // Línea de circuito (departamental, senior, etc.)
  @Column()
  circuitLine: string;

  // Categoría (INTERMEDIA, SEGUNDA, TERCERA, etc.)
  @Column()
  category: string;

  // Puntos acumulados en la temporada
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPoints: number;

  // Puntos de bonos de méritos acumulados (Art. 8)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  meritPoints: number;

  // Torneos jugados en la temporada
  @Column({ default: 0 })
  tournamentsPlayed: number;

  // Posición actual en el escalafón
  @Column({ default: 0 })
  position: number;

  // Año de la temporada
  @Column()
  season: number;

  // Última vez que se actualizó el escalafón
  @UpdateDateColumn()
  updatedAt: Date;
}
