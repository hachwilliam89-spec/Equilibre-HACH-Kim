import { Inject, Injectable } from '@nestjs/common';
import type { User } from '../../../auth/domain/entities/user.entity';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../../auth/domain/ports/user-repository.port';
import { GetMeasurementHistoryUseCase } from '../../../measurements/application/use-cases/get-measurement-history.use-case';
import {
  GetWeightTrackingStatusUseCase,
  type WeightTrackingStatus,
} from '../../../measurements/application/use-cases/get-weight-tracking-status.use-case';
import type { Measurement } from '../../../measurements/domain/entities/measurement.entity';
import { GetFoodBudgetStatusUseCase } from '../../../nutrition/application/use-cases/get-food-budget-status.use-case';
import type { FoodBudgetResult } from '../../../nutrition/domain/services/food-budget-status';
import type { MacroTargets } from '../../../nutrition/domain/services/macro-targets';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import {
  serieCalorique,
  type JourCalorique,
} from '../../domain/services/serie-calorique';
import { chargerClientDuCoach } from '../client-du-coach';

export interface AlimentationCoach extends FoodBudgetResult {
  budgetCalorique: number;
  ciblesMacros: MacroTargets;
  /** Totaux des 7 derniers jours (UTC) : jamais le détail des aliments. */
  jours: JourCalorique[];
}

export interface ClientProgression {
  utilisateur: User;
  suiviPoids: WeightTrackingStatus | null;
  mesures: Measurement[];
  alimentation: AlimentationCoach | null;
}

/**
 * Fiche de progression d'un utilisateur pour son coach. Réutilise les cas
 * d'usage de l'utilisateur (mêmes statuts, mêmes calculs) après contrôle du
 * rattachement.
 */
@Injectable()
export class GetClientProgressionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
    private readonly weightStatus: GetWeightTrackingStatusUseCase,
    private readonly foodStatus: GetFoodBudgetStatusUseCase,
    private readonly history: GetMeasurementHistoryUseCase,
  ) {}

  async execute(input: {
    coachId: string;
    userId: string;
    jourCourantUtc?: string;
  }): Promise<ClientProgression> {
    const utilisateur = await chargerClientDuCoach(
      this.users,
      input.coachId,
      input.userId,
    );
    const [suiviPoids, statutAlimentaire, mesures] = await Promise.all([
      this.weightStatus.execute(input.userId),
      this.foodStatus.execute(input.userId),
      this.history.execute(input.userId),
    ]);

    let alimentation: AlimentationCoach | null = null;
    if (statutAlimentaire && suiviPoids) {
      const planId = suiviPoids.plan.id;
      const suivi = await this.suivis.charger(input.userId);
      const journaux = (suivi?.toProps().journauxAlimentaires ?? [])
        .map((journal) => journal.toProps())
        .filter((journal) => journal.planId === planId)
        .map((journal) => ({
          jourUtc: journal.jourUtc,
          totalCaloriesKcal: journal.totalCaloriesKcal,
          totalProteinesG: journal.totalProteinesG,
          totalGlucidesG: journal.totalGlucidesG,
          totalLipidesG: journal.totalLipidesG,
          nombreEntrees: journal.entrees.length,
        }));
      alimentation = {
        statut: statutAlimentaire.statut,
        ecartKcal: statutAlimentaire.ecartKcal,
        budgetCalorique: statutAlimentaire.budgetCalorique,
        ciblesMacros: statutAlimentaire.ciblesMacros,
        jours: serieCalorique(
          journaux,
          statutAlimentaire.budgetCalorique,
          input.jourCourantUtc ?? new Date().toISOString().slice(0, 10),
        ),
      };
    }

    return { utilisateur, suiviPoids, mesures, alimentation };
  }
}
