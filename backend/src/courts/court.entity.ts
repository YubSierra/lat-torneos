import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn } from 'typeorm';

export enum CourtSurface {
  CLAY  = 'clay',
  HARD  = 'hard',
  GRASS = 'grass',
}

@Entity('courts')
export class Court {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: CourtSurface,
    default: CourtSurface.CLAY,
  })
  surface: CourtSurface;

  // Sede donde está la cancha
  // Ej: "Sede María Luisa", "Sede Estadio"
  @Column({ nullable: true })
  sede: string;

  // Dirección específica de la sede
  @Column({ nullable: true })
  location: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}