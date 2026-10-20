import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { Activite } from '../../application/use-cases/get-activity.use-case';
import {
  PAS_MAX_PAR_JOUR,
  type MoyenneActivite,
  type PasQuotidien,
} from '../../domain/services/niveau-activite';

export const recordStepsSchema = z
  .object({
    nombrePas: z
      .number()
      .int()
      .min(0)
      .max(PAS_MAX_PAR_JOUR)
      .describe('Total de pas de la journee UTC en cours (0 a 50 000)'),
  })
  .strict();

export class RecordStepsDto extends createZodDto(recordStepsSchema) {}

export class PasQuotidienDto {
  @ApiProperty({ format: 'date', example: '2026-10-07' }) jourUtc: string;
  @ApiProperty({ example: 8200 }) nombrePas: number;
  @ApiProperty({ format: 'date-time' }) recuLe: string;
}

export class MoyenneActiviteDto {
  @ApiProperty({ format: 'date' }) debut: string;
  @ApiProperty({ format: 'date' }) fin: string;
  @ApiProperty() joursRenseignes: number;
  @ApiProperty({ type: Number, nullable: true }) moyennePas: number | null;
  @ApiProperty({
    enum: ['sedentaire', 'actif', 'sportif', 'athlete'],
    nullable: true,
  })
  niveau: MoyenneActivite['niveau'];
}

export class ActiviteDto {
  @ApiProperty({ type: PasQuotidienDto, isArray: true })
  historique: PasQuotidienDto[];
  @ApiProperty({ type: MoyenneActiviteDto }) moyenne7Jours: MoyenneActiviteDto;
}

export function toPasQuotidienDto(jour: PasQuotidien): PasQuotidienDto {
  return {
    jourUtc: jour.jourUtc,
    nombrePas: jour.nombrePas,
    recuLe: jour.recuLe.toISOString(),
  };
}

export function toActiviteDto(activite: Activite): ActiviteDto {
  return {
    historique: activite.historique.map(toPasQuotidienDto),
    moyenne7Jours: { ...activite.moyenne7Jours },
  };
}
