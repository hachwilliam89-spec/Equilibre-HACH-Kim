import { ApiProperty } from '@nestjs/swagger';
import type { PlanStatut } from '../../../plans/domain/entities/plan.entity';
import type { NiveauActivite } from '../../../plans/domain/services/metabolic-calculations';
import type { StatutSuivi } from '../../domain/services/measurement-suivi';
import type { WeightTrackingStatus } from '../../application/use-cases/get-weight-tracking-status.use-case';
import { MeasurementDto, toMeasurementDto } from './measurement.dto';

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

export function toSuiviDto(suivi: WeightTrackingStatus): SuiviDto {
  const planProps = suivi.plan.toProps();
  return {
    statut: suivi.statut,
    plan: {
      id: planProps.id,
      poidsDepart: planProps.poidsDepart,
      poidsCible: planProps.poidsCible,
      dateDebut: planProps.dateDebut.toISOString(),
      dateCible: planProps.dateCible.toISOString(),
      imcCible: planProps.imcCible,
      niveauActivite: planProps.niveauActivite,
      budgetCalorique: planProps.budgetCalorique,
      budgetPlafonneAuBmr: planProps.budgetPlafonneAuBmr,
      statut: planProps.statut,
    },
    derniereMesure: suivi.derniereMesure
      ? toMeasurementDto(suivi.derniereMesure)
      : null,
    poidsAttendu: suivi.ecart ? suivi.ecart.poidsAttendu : null,
    ecartKg: suivi.ecart ? suivi.ecart.ecartKg : null,
  };
}
