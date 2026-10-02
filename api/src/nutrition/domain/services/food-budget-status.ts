import { arrondirCentiemes } from '../entities/food-entry.entity';

export type FoodBudgetStatus =
  'dans-le-budget' | 'depassement' | 'pas-de-donnees-recentes';

export interface LatestFoodJournal {
  jourUtc: string;
  totalCaloriesKcal: number;
  nombreEntrees: number;
}

export interface FoodBudgetResult {
  statut: FoodBudgetStatus;
  ecartKcal: number | null;
}

export const TOLERANCE_KCAL = 150;
const JOUR_MS = 86_400_000;

/** Un journal vide ne constitue pas une consommation. L'écart est signé. */
export function determinerStatutBudget(
  budgetCalorique: number,
  jourCourantUtc: string,
  dernierJournal: LatestFoodJournal | null,
): FoodBudgetResult {
  if (!dernierJournal || dernierJournal.nombreEntrees === 0) {
    return { statut: 'pas-de-donnees-recentes', ecartKcal: null };
  }
  const anciennete =
    (Date.parse(`${jourCourantUtc}T00:00:00Z`) -
      Date.parse(`${dernierJournal.jourUtc}T00:00:00Z`)) /
    JOUR_MS;
  if (anciennete < 0 || anciennete > 1) {
    return { statut: 'pas-de-donnees-recentes', ecartKcal: null };
  }
  const ecartKcal = arrondirCentiemes(
    dernierJournal.totalCaloriesKcal - budgetCalorique,
  );
  return {
    statut: ecartKcal > TOLERANCE_KCAL ? 'depassement' : 'dans-le-budget',
    ecartKcal,
  };
}
