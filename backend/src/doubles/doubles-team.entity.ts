import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum DoublesTeamStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('doubles_teams')
export class DoublesTeam {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tournamentId: string;

  @Column()
  category: string;

  @Column()
  player1Id: string;

  @Column({ nullable: true })
  player2Id: string;

  @Column({ default: false })
  player1HasSingles: boolean;

  @Column({ default: false })
  player2HasSingles: boolean;

  // ── COBRO INDIVIDUAL POR JUGADOR ─────────────────
  // Cada jugador paga SU parte independientemente
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  player1AmountCharged: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  player2AmountCharged: number;

  // Total pareja = player1AmountCharged + player2AmountCharged
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountCharged: number;

  // ── ESTADO DE PAGO INDIVIDUAL ─────────────────────
  // pending | approved | manual
  @Column({ default: 'pending' })
  player1PaymentStatus: string;

  @Column({ default: 'pending' })
  player2PaymentStatus: string;

  // Estado general de pago de la pareja
  @Column({ default: 'pending' })
  paymentStatus: string;

  @Column({ nullable: true })
  paymentId: string;

  @Column({
    type: 'enum',
    enum: DoublesTeamStatus,
    default: DoublesTeamStatus.PENDING,
  })
  status: DoublesTeamStatus;

  @Column({ nullable: true })
  teamName: string;

  @Column({ nullable: true })
  seeding: number;

  @CreateDateColumn()
  createdAt: Date;
}
