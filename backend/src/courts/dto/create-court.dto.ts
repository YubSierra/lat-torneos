import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { CourtSurface } from '../court.entity';

export class CreateCourtDto {
  @IsString()
  name: string;

  @IsEnum(CourtSurface)
  surface: CourtSurface;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}