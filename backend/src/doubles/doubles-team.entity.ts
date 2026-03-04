import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum DoublesTeamStatus {
  PENDING  = 'pending',   // Esperando compañero o pago
  APPROVED = 'approved',  // Pareja confirmada y pago OK
  REJECTED = 'rejected',  // Rechazada
}

@Entity('doubles_teams')
export class DoublesTeam {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tournamentId: string;

  // Categoría resultante = la más alta entre los dos jugadores
  @Column()
  category: string;

  // Jugador 1 (quien crea la pareja)
  @Column()
  player1Id: string;

  // Jugador 2 (compañero)
  @Column({ nullable: true })
  player2Id: string;

  // ¿Ambos juegan singles en este torneo?
  @Column({ default: false })
  player1HasSingles: boolean;

  @Column({ default: false })
  player2HasSingles: boolean;

  // Estado del pago
  @Column({ default: 'pending' })
  paymentStatus: string; // pending | approved | manual

  @Column({ nullable: true })
  paymentId: string;

  // Monto cobrado por dobles
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountCharged: number;

  @Column({
    type: 'enum',
    enum: DoublesTeamStatus,
    default: DoublesTeamStatus.PENDING,
  })
  status: DoublesTeamStatus;

  // Nombre de la pareja (opcional)
  @Column({ nullable: true })
  teamName: string;

  // Siembra de la pareja
  @Column({ nullable: true })
  seeding: number;

  @CreateDateColumn()
  createdAt: Date;
}
