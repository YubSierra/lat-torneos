import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';


// Enum con TODOS los sistemas de juego del sistema
export enum TournamentType {
  // ── Sistemas LAT Oficiales ──────────────────────
  ELIMINATION = 'elimination', // Eliminación directa simple
  ROUND_ROBIN = 'round_robin', // Todos contra todos
  MASTER = 'master', // 2 grupos RR + eliminatoria
  // ── Sistemas Recreativos ────────────────────────
  AMERICANO = 'americano', // Parejas rotativas
  KING_OF_COURT = 'king_of_court', // Retador vs ganador por cancha
  SUPERTIEBREAK = 'supertiebreak', // Solo tiebreaks a 10 pts
  BOX_LEAGUE = 'box_league', // Grupos fijos con fechas flexibles
  LADDER = 'ladder', // Escalera de retos
  SHORT_SET = 'short_set', // 3 de 5 short sets
  PRO_SET = 'pro_set', // 1 set a 8 games + MTB
}

export enum CircuitLine {
  DEPARTAMENTAL = 'departamental',
  INTER_ESCUELAS = 'inter_escuelas',
  INFANTIL = 'infantil',
  SENIOR = 'senior',
  EDADES_FCT = 'edades_fct',
  RECREATIVO = 'recreativo',
}

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: TournamentType })
  type: TournamentType;

  @Column({ type: 'enum', enum: CircuitLine })
  circuitLine: CircuitLine;

  @Column({ nullable: true })
  stageNumber: number; // Etapa 1-7, o null para torneos recreativos

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  inscriptionValue: number; // Valor en COP

  @Column({ type: 'date' })
  registrationStart: Date;

  @Column({ type: 'date' })
  registrationEnd: Date;

  @Column({ type: 'date' })
  eventStart: Date;

  @Column({ type: 'date' })
  eventEnd: Date;

  @Column({ default: 6 })
  minPlayers: number; // Mínimo 6 por categoría (Art. 23)

  @Column({
    type: 'enum',
    enum: ['draft', 'open', 'closed', 'active', 'completed'],
    default: 'draft',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
