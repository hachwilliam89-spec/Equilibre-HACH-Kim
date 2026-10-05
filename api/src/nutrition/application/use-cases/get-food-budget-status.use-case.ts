import { Inject, Injectable } from '@nestjs/common';
import {
  PLAN_REPOSITORY,
  type PlanRepositoryPort,
} from '../../../plans/domain/ports/plan-repository.port';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import { DailyFoodJournal } from '../../domain/entities/daily-food-journal.entity';
import {
  determinerStatutBudget,
  type FoodBudgetResult,
} from '../../domain/services/food-budget-status';
import {
  ciblesMacros,
  objectifDepuisPoids,
  type MacroTargets,
} from '../../domain/services/macro-targets';

export interface FoodBudgetTracking extends FoodBudgetResult {
  budgetCalorique: number;
  ciblesMacros: MacroTargets;
  journal: DailyFoodJournal | null;
}

@Injectable()
export class GetFoodBudgetStatusUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(userId: string): Promise<FoodBudgetTracking | null> {
    const plan = await this.plans.findActiveByUserId(userId);
    if (!plan) return null;
    const journal = await this.suivis.lireDernierJournalAlimentaireAvecEntrees(
      userId,
      plan.id,
    );
    const planProps = plan.toProps();
    const budgetCalorique = planProps.budgetCalorique;
    const cibles = ciblesMacros({
      budgetCalorique,
      poidsKg: planProps.poidsDepart,
      objectif: objectifDepuisPoids(
        planProps.poidsDepart,
        planProps.poidsCible,
      ),
      niveauActivite: planProps.niveauActivite,
    });
    const last = journal?.toProps();
    const result = determinerStatutBudget(
      budgetCalorique,
      new Date().toISOString().slice(0, 10),
      last
        ? {
            jourUtc: last.jourUtc,
            totalCaloriesKcal: last.totalCaloriesKcal,
            nombreEntrees: last.entrees.length,
          }
        : null,
    );
    return { ...result, budgetCalorique, ciblesMacros: cibles, journal };
  }
}
