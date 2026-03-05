import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn } from 'typeorm';

export enum MatchStatus {
  PENDING   = 'pending',
  LIVE      = 'live',
  COMPLETED = 'completed',
  WO        = 'wo',
}

export enum MatchRound {
  R64  = 'R64',
  R32  = 'R32',
  R16  = 'R16',
  QF   = 'QF',
  SF   = 'SF',
  F    = 'F',
  RR   = 'RR',
  RR_A = 'RR_A',
  RR_B = 'RR_B',
  SF_M = 'SF_M',
  F_M  = 'F_M',
}

@Entity('matches')
export class Match {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tournamentId: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  courtId: string;

  @Column({ type: 'enum', enum: MatchRound })
  round: MatchRound;

  @Column({ nullable: true })
  player1Id: string;

  @Column({ nullable: true })
  player2Id: string;

  @Column({ nullable: true })
  winnerId: string;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.PENDING })
  status: MatchStatus;

  // ── MARCADOR ────────────────────────────────────
  @Column({ default: 0 })
  sets1: number;

  @Column({ default: 0 })
  sets2: number;

  @Column({ default: 0 })
  games1: number;

  @Column({ default: 0 })
  games2: number;

  @Column({ default: '0' })
  points1: string;

  @Column({ default: '0' })
  points2: string;

  // ── PROGRAMACIÓN ────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ default: 90 })
  estimatedDuration: number;

  @Column({ nullable: true })
  seeding1: number;

  @Column({ nullable: true })
  seeding2: number;

  // ── SISTEMA DE JUEGO ─────────────────────────────
  // Guardado como JSON para flexibilidad total
  @Column({ type: 'jsonb', nullable: true })
  gameFormat: {
    sets: number; // 1, 2, 3, 5
    gamesPerSet: number; // 4, 6, 8
    withAd: boolean; // Con o sin Ad
    tiebreakAtDeuce: boolean; // Tiebreak al empate en games
    tiebreakPoints: number; // 7, 10, 12
    finalSetTiebreak: boolean; // Match tiebreak al empate en sets
    finalSetPoints: number; // 7, 10, 12
  };

  // ── GRUPO DEL ROUND ROBIN ────────────────────────
  @Column({ nullable: true })
  groupLabel: string;

  @CreateDateColumn()
  createdAt: Date;
}
