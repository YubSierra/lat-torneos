import { Entity, PrimaryGeneratedColumn, Column,
         ManyToOne, JoinColumn } from 'typeorm';
import { Court } from './court.entity';

@Entity('court_schedules')
export class CourtSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Court)
  @JoinColumn()
  court: Court;

  @Column()
  courtId: string;

  @Column({ type: 'date' })
  date: Date;

  // Hora de inicio en formato HH:MM (ej: "08:00")
  @Column({ type: 'time' })
  timeStart: string;

  // Hora de fin en formato HH:MM (ej: "20:00")
  @Column({ type: 'time' })
  timeEnd: string;

  // Si está disponible o ya fue asignado a un partido
  @Column({ default: true })
  isAvailable: boolean;

  // ID del partido asignado a este slot (null si está libre)
  @Column({ nullable: true })
  matchId: string;
}