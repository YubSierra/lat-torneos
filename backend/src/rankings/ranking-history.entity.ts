import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn } from 'typeorm';

@Entity('ranking_history')
export class RankingHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  playerId: string;

  @Column()
  tournamentId: string;

  @Column()
  tournamentName: string;

  @Column()
  circuitLine: string;

  @Column()
  category: string;

  // Ronda alcanzada en el torneo
  @Column()
  roundReached: string;

  // Puntos base ganados (Art. 7)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  basePoints: number;

  // Bonos de méritos ganados (Art. 8)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  meritBonus: number;

  // Puntos totales de este torneo
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPoints: number;

  // Modalidad (singles o doubles)
  @Column({ default: 'singles' })
  modality: string;

  // Año de la temporada
  @Column()
  season: number;

  @CreateDateColumn()
  createdAt: Date;
}
