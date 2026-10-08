import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../../auth/domain/entities/user.entity';
import {
  MeasurementDto,
  toMeasurementDto,
} from '../../../measurements/infrastructure/http/measurement.dto';
import {
  SuiviDto,
  toSuiviDto,
} from '../../../measurements/infrastructure/http/suivi.dto';
import type { FoodBudgetStatus } from '../../../nutrition/domain/services/food-budget-status';
import { MacroTargetsDto } from '../../../nutrition/infrastructure/http/food-budget-status.dto';
import type { ClientOverview } from '../../application/use-cases/get-clients-overview.use-case';
import type { ClientProgression } from '../../application/use-cases/get-client-progression.use-case';
import type { StatutJour } from '../../domain/services/serie-calorique';

const STATUTS_ALIMENTAIRES = [
  'dans-le-budget',
  'depassement',
  'pas-de-donnees-recentes',
];

export class ClientDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) tailleCm?: number;
  @ApiProperty({ required: false }) age?: number;
  @ApiProperty({ required: false, enum: ['homme', 'femme'] }) sexe?:
    'homme' | 'femme';
}

export class StatutAlimentaireDto {
  @ApiProperty({ enum: STATUTS_ALIMENTAIRES }) statut: FoodBudgetStatus;
  @ApiProperty({ type: Number, nullable: true }) ecartKcal: number | null;
}

export class ClientOverviewDto extends ClientDto {
  @ApiProperty({
    type: SuiviDto,
    nullable: true,
    description: 'null sans plan actif',
  })
  suiviPoids: SuiviDto | null;

  @ApiProperty({
    type: StatutAlimentaireDto,
    nullable: true,
    description: 'null sans plan actif',
  })
  alimentation: StatutAlimentaireDto | null;
}

export class JourCaloriqueDto {
  @ApiProperty({ format: 'date', example: '2026-10-08' }) jourUtc: string;
  @ApiProperty() totalCaloriesKcal: number;
  @ApiProperty() totalProteinesG: number;
  @ApiProperty() totalGlucidesG: number;
  @ApiProperty() totalLipidesG: number;
  @ApiProperty() nombreEntrees: number;
  @ApiProperty({ type: Number, nullable: true }) ecartKcal: number | null;
  @ApiProperty({ enum: ['dans-le-budget', 'depassement', 'aucune-entree'] })
  statut: StatutJour;
}

export class AlimentationCoachDto extends StatutAlimentaireDto {
  @ApiProperty() budgetCalorique: number;
  @ApiProperty({ type: MacroTargetsDto }) ciblesMacros: MacroTargetsDto;
  @ApiProperty({
    type: JourCaloriqueDto,
    isArray: true,
    description:
      '7 derniers jours UTC, du plus ancien au plus récent ; totaux uniquement',
  })
  jours: JourCaloriqueDto[];
}

export class ClientProgressionDto {
  @ApiProperty({ type: ClientDto }) utilisateur: ClientDto;

  @ApiProperty({ type: SuiviDto, nullable: true }) suiviPoids: SuiviDto | null;

  @ApiProperty({
    type: MeasurementDto,
    isArray: true,
    description: 'Pesées conservées (3 mois), plus récentes en premier',
  })
  mesures: MeasurementDto[];

  @ApiProperty({ type: AlimentationCoachDto, nullable: true })
  alimentation: AlimentationCoachDto | null;
}

export function toClientDto(user: User): ClientDto {
  return {
    id: user.id,
    email: user.email,
    tailleCm: user.tailleCm,
    age: user.age,
    sexe: user.sexe,
  };
}

export function toClientOverviewDto(
  overview: ClientOverview,
): ClientOverviewDto {
  return {
    ...toClientDto(overview.utilisateur),
    suiviPoids: overview.suiviPoids ? toSuiviDto(overview.suiviPoids) : null,
    alimentation: overview.alimentation
      ? {
          statut: overview.alimentation.statut,
          ecartKcal: overview.alimentation.ecartKcal,
        }
      : null,
  };
}

export function toClientProgressionDto(
  progression: ClientProgression,
): ClientProgressionDto {
  const { alimentation } = progression;
  return {
    utilisateur: toClientDto(progression.utilisateur),
    suiviPoids: progression.suiviPoids
      ? toSuiviDto(progression.suiviPoids)
      : null,
    mesures: progression.mesures.map(toMeasurementDto),
    alimentation: alimentation
      ? {
          statut: alimentation.statut,
          ecartKcal: alimentation.ecartKcal,
          budgetCalorique: alimentation.budgetCalorique,
          ciblesMacros: alimentation.ciblesMacros,
          jours: alimentation.jours.map((jour) => ({ ...jour })),
        }
      : null,
  };
}
