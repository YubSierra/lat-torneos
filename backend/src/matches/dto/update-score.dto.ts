import { IsString, IsEnum, IsNumber,
         IsOptional, IsBoolean } from 'class-validator';
import { MatchStatus } from '../match.entity';

export class UpdateScoreDto {
  @IsString()
  matchId: string;

  // Sets ganados por cada jugador
  @IsNumber()
  sets1: number; // Sets jugador 1

  @IsNumber()
  sets2: number; // Sets jugador 2

  // Games del set actual
  @IsNumber()
  games1: number;

  @IsNumber()
  games2: number;

  // Puntos del game actual (0, 15, 30, 40, AD)
  @IsOptional()
  @IsString()
  points1?: string;

  @IsOptional()
  @IsString()
  points2?: string;

  // ¿Es walkover? (Art. 23 LAT: W.O. = 6-0 6-0)
  @IsOptional()
  @IsBoolean()
  isWalkover?: boolean;

  // ID del ganador (cuando el partido termina)
  @IsOptional()
  @IsString()
  winnerId?: string;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}
