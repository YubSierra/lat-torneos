import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Modality } from '../enrollment.entity';

export class CreateEnrollmentDto {
  @IsUUID()
  tournamentId: string;

  @IsUUID()
  playerId: string;

  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @IsEnum(Modality)
  modality: Modality;

  @IsString()
  category: string;
}