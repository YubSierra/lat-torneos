import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum TournamentType {
  ELIMINATION    = 'elimination',
  ROUND_ROBIN    = 'round_robin',
  MASTER         = 'master',
  AMERICANO      = 'americano',
  KING_OF_COURT  = 'king_of_court',
  SUPERTIEBREAK  = 'supertiebreak',
  BOX_LEAGUE     = 'box_league',
  LADDER         = 'ladder',
  SHORT_SET      = 'short_set',
  PRO_SET        = 'pro_set',
}

export enum CircuitLine {
  DEPARTAMENTAL  = 'departamental',
  INTER_ESCUELAS = 'inter_escuelas',
  INFANTIL       = 'infantil',
  SENIOR         = 'senior',
  EDADES_FCT     = 'edades_fct',
  RECREATIVO     = 'recreativo',
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
  stageNumber: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  inscriptionValue: number;

  @Column({ type: 'date' })
  registrationStart: Date;

  @Column({ type: 'date' })
  registrationEnd: Date;

  @Column({ type: 'date' })
  eventStart: Date;

  @Column({ type: 'date' })
  eventEnd: Date;

  @Column({ default: 6 })
  minPlayers: number;

  @Column({
    type: 'enum',
    enum: ['draft', 'open', 'closed', 'active', 'completed'],
    default: 'draft',
  })
  status: string;

  // ── CONFIGURACIÓN DE DOBLES ──────────────────────

  // ¿El torneo tiene modalidad de dobles?
  @Column({ default: false })
  hasDoubles: boolean;

  // Valor inscripción dobles (por pareja)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  doublesValue: number;

  // ¿Los jugadores de singles tienen dobles incluido?
  // true = incluido sin costo adicional
  // false = deben pagar doublesAdditionalValue
  @Column({ default: false })
  doublesIncludedForSingles: boolean;

  // Valor adicional para jugadores de singles que quieran jugar dobles
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  doublesAdditionalValue: number;

  // ── SISTEMA DE JUEGO POR DEFECTO ─────────────────
  @Column({ default: true })
  withAd: boolean;

  // Formato por defecto serializado como JSON
  @Column({ type: 'jsonb', nullable: true })
  defaultGameFormat: {
    sets: number;
    gamesPerSet: number;
    withAd: boolean;
    tiebreakAtDeuce: boolean;
    tiebreakPoints: number;
    finalSetTiebreak: boolean;
    finalSetPoints: number;
  };

  // Formato por ronda { R16: {...}, QF: {...}, SF: {...}, F: {...} }
  @Column({ type: 'jsonb', nullable: true })
  roundGameFormats: Record<string, {
    sets: number;
    gamesPerSet: number;
    withAd: boolean;
    tiebreakAtDeuce: boolean;
    tiebreakPoints: number;
    finalSetTiebreak: boolean;
    finalSetPoints: number;
  }>;

  // ── CATEGORÍAS DEL TORNEO ────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  categories: {
    name: string;
    description?: string;
    isDefault: boolean;
  }[];

  @CreateDateColumn()
  createdAt: Date;
}