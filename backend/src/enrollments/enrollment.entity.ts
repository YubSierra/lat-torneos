import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tournament } from '../tournaments/tournament.entity';

export enum EnrollmentStatus {
  PENDING   = 'pending',   // Pago pendiente (online)
  APPROVED  = 'approved',  // Inscripción activa / pago confirmado
  REJECTED  = 'rejected',  // Pago rechazado
  ALTERNATE = 'alternate', // Jugador alterno (Art. 10 LAT)
  RESERVED  = 'reserved',  // Cupo apartado — pago NO confirmado aún
}

export enum PaymentMethod {
  MANUAL      = 'manual',      // Efectivo presencial
  TRANSFER    = 'transfer',    // Transferencia bancaria
  MERCADOPAGO = 'mercadopago', // Pasarela online MP
  COURTESY    = 'courtesy',    // Cortesía / exento
  RESERVED    = 'reserved',    // Sin confirmar — reservado
}

export enum Modality {
  SINGLES = 'singles',
  DOUBLES = 'doubles',
}

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tournament)
  @JoinColumn()
  tournament: Tournament;

  @Column()
  tournamentId: string;

  @Column()
  playerId: string;

  @Column({ nullable: true })
  partnerId: string;

  @Column({ type: 'enum', enum: Modality, default: Modality.SINGLES })
  modality: Modality;

  @Column()
  category: string;

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.PENDING,
  })
  status: EnrollmentStatus;

  @Column({ nullable: true })
  seeding: number;

  // paymentId: ID de MP, 'MANUAL', 'TRANSFER', 'COURTESY', 'RESERVED'
  @Column({ nullable: true })
  paymentId: string;

  // Forma de pago seleccionada
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
    default: null,
  })
  paymentMethod: PaymentMethod;

  // Notas internas del admin
  @Column({ nullable: true })
  adminNotes: string;

  @CreateDateColumn()
  enrolledAt: Date;
}
