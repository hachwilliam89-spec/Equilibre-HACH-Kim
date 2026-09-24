import { ApiProperty } from '@nestjs/swagger';
import type {
  MeasurementSource,
  MeasurementStatut,
} from '../../domain/entities/measurement.entity';

export class MeasurementDto {
  @ApiProperty({ description: 'Identifiant unique de la mesure' })
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ description: 'Plan de rattachement, y compris ancien plan' })
  planId: string;

  @ApiProperty({
    description: 'Poids en kilogrammes, strictement positif',
    example: 72.5,
  })
  poidsKg: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Réception par l’API en UTC',
  })
  receivedAt: string;

  @ApiProperty({ format: 'date', example: '2026-09-24' })
  jourUtc: string;

  @ApiProperty({ enum: ['automatique', 'manuelle'] })
  source: MeasurementSource;

  @ApiProperty({ enum: ['valide', 'suspecte', 'hors-plan'] })
  statut: MeasurementStatut;
}
