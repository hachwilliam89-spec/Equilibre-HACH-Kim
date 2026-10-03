import type { FoodBudgetStatus, FoodJournal, ReferenceFood } from "./api";

type Status = NonNullable<FoodBudgetStatus>["statut"];

export const foodStatusPresentation: Record<
  Status,
  { label: string; symbol: string; background: string; color: string }
> = {
  "dans-le-budget": {
    label: "Dans le budget",
    symbol: "✓",
    background: "#e1f5eb",
    color: "#087454",
  },
  depassement: {
    label: "Dépassement",
    symbol: "!",
    background: "#fff0dc",
    color: "#9a4d00",
  },
  "pas-de-donnees-recentes": {
    label: "Pas de données récentes",
    symbol: "○",
    background: "#edf1f0",
    color: "#536861",
  },
};

export function journalForDay(
  status: FoodBudgetStatus,
  dayUtc: string,
): FoodJournal | null {
  return status?.journal?.jourUtc === dayUtc ? status.journal : null;
}

export function formatNutrition(value: number): string {
  return Number(value.toFixed(1)).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}

export function parseFoodQuantity(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isFinite(quantity) && quantity > 0 && quantity <= 10000
    ? quantity
    : null;
}

export function nutritionForQuantity(food: ReferenceFood, quantity: number) {
  const factor = quantity / 100;
  return {
    caloriesKcal: food.caloriesKcalPour100g * factor,
    proteinesG: food.proteinesGPour100g * factor,
    glucidesG: food.glucidesGPour100g * factor,
    lipidesG: food.lipidesGPour100g * factor,
  };
}

export const CALORIE_TOLERANCE_KCAL = 150;

export function dailyBudgetPresentation(
  total: number,
  budget: number,
  hasEntries: boolean,
) {
  const scale = Math.max(budget + CALORIE_TOLERANCE_KCAL, total, 1);
  const overTolerance = hasEntries && total > budget + CALORIE_TOLERANCE_KCAL;
  const note = !hasEntries
    ? "Aucune entrée consignée aujourd’hui."
    : total < budget
      ? `${formatNutrition(budget - total)} kcal restantes avant la cible.`
      : total === budget
        ? "Cible calorique atteinte."
        : overTolerance
          ? `${formatNutrition(total - budget)} kcal au-dessus de la cible : dépassement.`
          : `${formatNutrition(total - budget)} kcal au-dessus de la cible, dans la tolérance.`;
  return {
    note,
    overTolerance,
    consumedPercent: Math.max(0, Math.min((total / scale) * 100, 100)),
    targetPercent: Math.max(0, Math.min((budget / scale) * 100, 100)),
  };
}
