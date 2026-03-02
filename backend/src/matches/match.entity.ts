import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn, OneToMany } from 'typeorm';

export enum MatchStatus {
  PENDING   = 'pending',    // Programado, sin jugar
  LIVE      = 'live',       // En juego ahora
  COMPLETED = 'completed',  // Finalizado
  WO        = 'wo',         // Walkover (Art. 23)
}

export enum MatchRound {
  R64  = 'R64',   // Ronda de 64
  R32  = 'R32',   // Ronda de 32
  R16  = 'R16',   // Ronda de 16
  QF   = 'QF',    // Cuartos de final
  SF   = 'SF',    // Semifinal
  F    = 'F',     // Final
  RR   = 'RR',    // Round Robin
  // Máster LAT
  RR_A = 'RR_A',  // Grupo A del Máster
  RR_B = 'RR_B',  // Grupo B del Máster
  SF_M = 'SF_M',  // Semifinal del Máster
  F_M  = 'F_M',   // Final del Máster
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

  @Column({
    type: 'enum',
    enum: MatchRound,
  })
  round: MatchRound;

  // Jugador/equipo 1
  @Column({ nullable: true })
  player1Id: string;

  // Jugador/equipo 2
  @Column({ nullable: true })
  player2Id: string;

  // Ganador del partido
  @Column({ nullable: true })
  winnerId: string;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.PENDING,
  })
  status: MatchStatus;

  // Fecha y hora programada
  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  // Duración estimada en minutos
  @Column({ default: 90 })
  estimatedDuration: number;

  // Número de siembra del jugador 1 y 2
  @Column({ nullable: true })
  seeding1: number;

  @Column({ nullable: true })
  seeding2: number;

  @CreateDateColumn()
  createdAt: Date;
}