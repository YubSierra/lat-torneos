import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('referee_assignments')
export class RefereeAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  refereeId: string;

  @Column()
  tournamentId: string;

  @CreateDateColumn()
  assignedAt: Date;
}
