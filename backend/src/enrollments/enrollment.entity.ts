import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tournament } from '../tournaments/tournament.entity';

export enum EnrollmentStatus {
  PENDING = 'pending', // Inscripción creada, pago pendiente
  APPROVED = 'approved', // Pago confirmado, inscripción activa
  REJECTED = 'rejected', // Pago rechazado
  ALTERNATE = 'alternate', // Jugador alterno (Art. 10)
}

export enum Modality {
  SINGLES = 'singles',
  DOUBLES = 'doubles',
}

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relación con el torneo
  @ManyToOne(() => Tournament)
  @JoinColumn()
  tournament: Tournament;

  @Column()
  tournamentId: string;

  // Jugador principal
  @Column()
  playerId: string;

  // Compañero de dobles (opcional)
  @Column({ nullable: true })
  partnerId: string;

  @Column({
    type: 'enum',
    enum: Modality,
    default: Modality.SINGLES,
  })
  modality: Modality;

  // Categoría: INTERMEDIA, SEGUNDA, etc.
  @Column()
  category: string;

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.PENDING,
  })
  status: EnrollmentStatus;

  // Número de siembra asignado por el admin
  @Column({ nullable: true })
  seeding: number;

  // ID del pago asociado
  @Column({ nullable: true })
  paymentId: string;

  @CreateDateColumn()
  enrolledAt: Date;
}
