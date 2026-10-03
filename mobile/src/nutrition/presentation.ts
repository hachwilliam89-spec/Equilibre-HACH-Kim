import type {
  FoodBudgetStatus,
  FoodEntry,
  FoodJournal,
  MealCategory,
  ReferenceFood,
} from "./api";

export const mealCategories: { value: MealCategory; label: string }[] = [
  { value: "petit-dejeuner", label: "Petit-déjeuner" },
  { value: "dejeuner", label: "Déjeuner" },
  { value: "diner", label: "Dîner" },
  { value: "collation", label: "Collation" },
];

export function groupEntriesByMeal(entries: FoodEntry[]) {
  return [...mealCategories, { value: "non-classe" as const, label: "Non classé" }]
    .map(({ value, label }) => {
      const items = entries.filter((entry) => entry.categorieRepas === value);
      return {
        value,
        label,
        entries: items,
        caloriesKcal: items.reduce((sum, entry) => sum + entry.caloriesKcal, 0),
      };
    })
    .filter((group) => group.entries.length > 0);
}

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
  const zoneStart = Math.max(0, budget - CALORIE_TOLERANCE_KCAL);
  const zoneEnd = budget + CALORIE_TOLERANCE_KCAL;
  const scale = Math.max(zoneEnd, total, 1);
  const overTolerance = hasEntries && total > zoneEnd;
  const inTargetZone = hasEntries && total >= zoneStart && !overTolerance;
  const phase = !hasEntries
    ? "empty"
    : overTolerance
      ? "over"
      : inTargetZone
        ? "target"
        : "progress";
  const note = !hasEntries
    ? "Aucune entrée consignée aujourd’hui."
    : overTolerance
      ? `${formatNutrition(total - budget)} kcal au-dessus de la cible : dépassement.`
      : !inTargetZone
        ? `${formatNutrition(zoneStart - total)} kcal avant la zone cible.`
        : total < budget
          ? `Zone cible atteinte, ${formatNutrition(budget - total)} kcal sous la cible.`
          : total === budget
            ? "Cible calorique atteinte."
            : `Zone cible atteinte, ${formatNutrition(total - budget)} kcal au-dessus de la cible.`;
  return {
    note,
    phase,
    overTolerance,
    zoneStart,
    zoneEnd,
    zoneStartPercent: Math.max(0, Math.min((zoneStart / scale) * 100, 100)),
    zoneEndPercent: Math.max(0, Math.min((zoneEnd / scale) * 100, 100)),
    consumedPercent: Math.max(0, Math.min((total / scale) * 100, 100)),
    targetPercent: Math.max(0, Math.min((budget / scale) * 100, 100)),
  };
}
