import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relación 1:1 con User (cada jugador tiene un usuario)
  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  fullName: string;

  @Column({ unique: true })
  docNumber: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'enum', enum: ['M', 'F'] })
  gender: string;

  @Column({ nullable: true })
  clubId: string;

  // Estado del carné LAT ($30.000/año - Art. 11 Reglamento)
  @Column({ default: false })
  carneActive: boolean;

  @Column({ type: 'date', nullable: true })
  carneExpiry: Date;

  // Posición en escalafón nacional (para validar categoría - Art. 9)
  @Column({ nullable: true })
  nationalRankingPos: number;
}
