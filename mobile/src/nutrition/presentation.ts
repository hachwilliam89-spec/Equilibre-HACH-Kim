import type { FoodBudgetStatus, FoodJournal } from "./api";

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
