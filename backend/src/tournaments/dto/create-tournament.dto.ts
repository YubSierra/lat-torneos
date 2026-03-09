import { IsString, IsEnum, IsNumber, IsDateString,
         Min, Max, IsOptional, IsBoolean } from 'class-validator';
import { TournamentType, CircuitLine } from '../tournament.entity';

export class CreateTournamentDto {

  @IsString()
  name: string;

  @IsEnum(TournamentType)
  type: TournamentType;

  @IsEnum(CircuitLine)
  circuitLine: CircuitLine;

  @IsOptional()
  @IsNumber()
  stageNumber?: number;

  @IsNumber()
  @Min(0)
  @Max(500000)
  inscriptionValue: number;

  @IsDateString()
  registrationStart: string;

  @IsDateString()
  registrationEnd: string;

  @IsDateString()
  eventStart: string;

  @IsDateString()
  eventEnd: string;

  // ── DOBLES ──────────────────────────────────────

  @IsOptional()
  @IsBoolean()
  hasDoubles?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  doublesValue?: number;

  @IsOptional()
  @IsBoolean()
  doublesIncludedForSingles?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  doublesAdditionalValue?: number;

  // ── SISTEMA DE JUEGO ─────────────────────────────

  @IsOptional()
  @IsBoolean()
  withAd?: boolean;

  @IsOptional()
  defaultGameFormat?: {
    sets: number;
    gamesPerSet: number;
    withAd: boolean;
    tiebreakAtDeuce: boolean;
    tiebreakPoints: number;
    finalSetTiebreak: boolean;
    finalSetPoints: number;
  };

  @IsOptional()
  roundGameFormats?: Record<string, {
    sets: number;
    gamesPerSet: number;
    withAd: boolean;
    tiebreakAtDeuce: boolean;
    tiebreakPoints: number;
    finalSetTiebreak: boolean;
    finalSetPoints: number;
  }>;

  @IsOptional()
  categories?: {
    name: string;
    description?: string;
    isDefault: boolean;
  }[];
}
