import { Entity, PrimaryGeneratedColumn, Column,
         CreateDateColumn, OneToMany } from 'typeorm';

export enum CourtSurface {
  CLAY  = 'clay',   // Arcilla
  HARD  = 'hard',   // Dura
  GRASS = 'grass',  // Pasto
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

  @Column({ nullable: true })
  location: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
