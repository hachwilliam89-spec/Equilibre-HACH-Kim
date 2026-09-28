import { ApiProperty } from '@nestjs/swagger';
import type { PlanStatut } from '../../../plans/domain/entities/plan.entity';
import type { NiveauActivite } from '../../../plans/domain/services/metabolic-calculations';
import type { StatutSuivi } from '../../domain/services/measurement-suivi';
import { MeasurementDto } from './measurement.dto';

export class PlanResumeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  poidsDepart: number;

  @ApiProperty()
  poidsCible: number;

  @ApiProperty({ type: String, format: 'date-time' })
  dateDebut: string;

  @ApiProperty({ type: String, format: 'date-time' })
  dateCible: string;

  @ApiProperty()
  imcCible: number;

  @ApiProperty()
  niveauActivite: NiveauActivite;

  @ApiProperty()
  budgetCalorique: number;

  @ApiProperty()
  budgetPlafonneAuBmr: boolean;

  @ApiProperty({ enum: ['actif', 'termine', 'annule'] })
  statut: PlanStatut;
}

export class SuiviDto {
  @ApiProperty({
    enum: [
      'en-attente-premiere-mesure',
      'pas-de-donnees-recentes',
      'dans-les-clous',
      'ecart-detecte',
    ],
    description: 'Statut de suivi calcule sur la derniere mesure valide',
  })
  statut: StatutSuivi;

  @ApiProperty({ type: PlanResumeDto })
  plan: PlanResumeDto;

  @ApiProperty({
    type: MeasurementDto,
    nullable: true,
    description: 'Derniere mesure valide du plan, ou null',
  })
  derniereMesure: MeasurementDto | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Poids attendu au jour de la derniere mesure valide',
  })
  poidsAttendu: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Ecart signe (mesure moins attendu), en kg',
  })
  ecartKg: number | null;
}
