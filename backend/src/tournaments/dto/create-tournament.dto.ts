import { IsString, IsEnum, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { TournamentType, CircuitLine } from '../tournament.entity';

export class CreateTournamentDto {
  @IsString()
  name: string;

  @IsEnum(TournamentType)
  type: TournamentType;

  @IsEnum(CircuitLine)
  circuitLine: CircuitLine;

  @IsNumber()
  @Min(50000) // Art. 23: mínimo $50.000 COP
  @Max(150000) // Art. 23: máximo $150.000 COP
  inscriptionValue: number;

  @IsDateString()
  registrationStart: string;

  @IsDateString()
  registrationEnd: string;

  @IsDateString()
  eventStart: string;

  @IsDateString()
  eventEnd: string;
}
