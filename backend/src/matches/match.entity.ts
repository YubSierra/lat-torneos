// backend/src/matches/match.entity.ts  ← REEMPLAZA COMPLETO
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum MatchStatus {
  PENDING   = 'pending',
  LIVE      = 'live',
  COMPLETED = 'completed',
  WO        = 'wo',
  SUSPENDED = 'suspended',   // ← NUEVO: partido o jornada suspendida
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
  @Column({ type: 'jsonb', nullable: true })
  gameFormat: {
    sets: number;
    gamesPerSet: number;
    withAd: boolean;
    tiebreakAtDeuce: boolean;
    tiebreakPoints: number;
    finalSetTiebreak: boolean;
    finalSetPoints: number;
  };

  // ── MARCADOR EN VIVO ─────────────────────────────
  @Column({ nullable: true })
  currentSet: number;

  @Column({ type: 'jsonb', nullable: true })
  setsHistory: any;

  // ── GRUPO DEL ROUND ROBIN ────────────────────────
  @Column({ nullable: true })
  groupLabel: string;

  // ── SUSPENSIÓN ───────────────────────────────────
  // Fecha y hora en que se suspendió
  @Column({ type: 'timestamp', nullable: true })
  suspendedAt: Date;

  // Motivo de la suspensión (Lluvia, Oscuridad, Lesión, Fuerza mayor, etc.)
  @Column({ nullable: true })
  suspensionReason: string;

  // Resultado parcial al momento de la suspensión
  // Se muestra en el cuadro hasta que el partido se reanude y finalice
  @Column({ type: 'jsonb', nullable: true })
  partialResult: {
    sets1: number;
    sets2: number;
    games1: number;
    games2: number;
    setsHistory: { games1: number; games2: number; tiebreak1?: number; tiebreak2?: number }[];
    note?: string;  // ej: "Suspendido por lluvia en el 2° set"
  };

  // Fecha reprogramada (para mostrar al público)
  @Column({ type: 'timestamp', nullable: true })
  resumeScheduledAt: Date;

  // ── ETIQUETA PARA RONDAS PENDIENTES ─────────────
  // Ej: "Ganador Grupo A", "Ganador QF1", "Ganador SF"
  // Se llena al generar el cuadro cuando aún no hay jugadores
  @Column({ nullable: true })
  player1Label: string;

  @Column({ nullable: true })
  player2Label: string;

  @CreateDateColumn()
  createdAt: Date;
}