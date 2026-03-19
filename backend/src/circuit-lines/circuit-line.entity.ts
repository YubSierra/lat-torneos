import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export interface CircuitRankingPoints {
  rrWinPoints: number;
  singles: {
    champion: number;
    F: number;
    SF: number;
    QF: number;
    R16: number;
    R32: number;
    R64: number;
  };
  doubles: {
    champion: number;
    F: number;
    SF: number;
    QF: number;
    R16: number;
    R32: number;
    R64: number;
  };
  master: {
    champion: number;
    F_M: number;
    SF_M: number;
  };
  merit: {
    seed1: number;
    seed2: number;
    seeds34: number;
    seeds58: number;
  };
}

export const DEFAULT_LAT_RANKING_POINTS: CircuitRankingPoints = {
  rrWinPoints: 2,
  singles:  { champion: 50, F: 35, SF: 25, QF: 18, R16: 10, R32: 6, R64: 2 },
  doubles:  { champion: 12, F:  8, SF:  6, QF:  4, R16:  2, R32: 0, R64: 0 },
  master:   { champion: 100, F_M: 70, SF_M: 50 },
  merit:    { seed1: 8, seed2: 6, seeds34: 4, seeds58: 2 },
};

@Entity('circuit_lines')
export class CircuitLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique slug used as reference in Tournament.circuitLine */
  @Column({ unique: true })
  slug: string;

  @Column()
  label: string;

  /** Seeded default lines cannot be deleted */
  @Column({ default: false })
  isDefault: boolean;

  /** null = no ranking for this circuit line */
  @Column({ type: 'jsonb', nullable: true })
  rankingPoints: CircuitRankingPoints | null;

  /** Custom categories shared across all tournaments in this circuit line */
  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  customCategories: string[];

  @CreateDateColumn()
  createdAt: Date;
}
