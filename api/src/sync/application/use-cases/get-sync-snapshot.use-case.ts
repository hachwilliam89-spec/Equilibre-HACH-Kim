import { Inject, Injectable } from '@nestjs/common';
import { ManageFavoriteFoodsUseCase } from '../../../foods/application/use-cases/manage-favorite-foods.use-case';
import type { Food } from '../../../foods/domain/entities/food.entity';
import { GetMeasurementHistoryUseCase } from '../../../measurements/application/use-cases/get-measurement-history.use-case';
import {
  GetWeightTrackingStatusUseCase,
  type WeightTrackingStatus,
} from '../../../measurements/application/use-cases/get-weight-tracking-status.use-case';
import type { Measurement } from '../../../measurements/domain/entities/measurement.entity';
import { GetFoodBudgetStatusUseCase } from '../../../nutrition/application/use-cases/get-food-budget-status.use-case';
import type { DailyFoodJournal } from '../../../nutrition/domain/entities/daily-food-journal.entity';
import type { MacroTargets } from '../../../nutrition/domain/services/macro-targets';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';

/** Jours de journal alimentaire embarqués : aujourd'hui et hier (UTC). */
export const JOURS_JOURNAL_EMBARQUES = 2;
const JOUR_MS = 86_400_000;

/**
 * Le « strict nécessaire » côté mobile : uniquement ce que l'utilisateur
 * voit dans ses écrans. Le statut alimentaire se recalcule sur l'appareil
 * à partir des deux derniers journaux (la règle ne regarde pas plus loin
 * qu'hier) ; le statut de trajectoire du poids, lui, reste calculé ici.
 */
export interface InstantaneSynchro {
  suiviPoids: WeightTrackingStatus | null;
  mesures: Measurement[];
  alimentation: {
    planId: string;
    budgetCalorique: number;
    ciblesMacros: MacroTargets;
    journaux: DailyFoodJournal[];
  } | null;
  favoris: Food[];
}

@Injectable()
export class GetSyncSnapshotUseCase {
  constructor(
    private readonly weightTracking: GetWeightTrackingStatusUseCase,
    private readonly measurementHistory: GetMeasurementHistoryUseCase,
    private readonly foodBudget: GetFoodBudgetStatusUseCase,
    private readonly favoriteFoods: ManageFavoriteFoodsUseCase,
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(
    userId: string,
    maintenant = new Date(),
  ): Promise<InstantaneSynchro> {
    const [suiviPoids, mesures, budget, favoris, suivi] = await Promise.all([
      this.weightTracking.execute(userId),
      this.measurementHistory.execute(userId),
      this.foodBudget.execute(userId),
      this.favoriteFoods.list(userId),
      this.suivis.charger(userId),
    ]);
    const planId = suiviPoids?.plan.id ?? null;
    const journaux: DailyFoodJournal[] = [];
    if (planId && suivi) {
      for (let decalage = 0; decalage < JOURS_JOURNAL_EMBARQUES; decalage++) {
        const jour = new Date(maintenant.getTime() - decalage * JOUR_MS)
          .toISOString()
          .slice(0, 10);
        const journal = suivi.trouverJournalAlimentaire(planId, jour);
        if (journal) journaux.push(journal);
      }
    }
    return {
      suiviPoids,
      mesures,
      alimentation:
        planId && budget
          ? {
              planId,
              budgetCalorique: budget.budgetCalorique,
              ciblesMacros: budget.ciblesMacros,
              journaux,
            }
          : null,
      favoris,
    };
  }
}
