import { journalForDay } from "../presentation";
import type { FoodBudgetStatus } from "../api";

const status: FoodBudgetStatus = {
  statut: "dans-le-budget",
  budgetCalorique: 1800,
  ecartKcal: -1540,
  journal: {
    planId: "plan-1",
    jourUtc: "2026-10-02",
    budgetCalorique: 1800,
    entrees: [],
    totalCaloriesKcal: 260,
    totalProteinesG: 5.4,
    totalGlucidesG: 56,
    totalLipidesG: 0.6,
  },
};

it("n'affiche pas le journal d'hier comme s'il appartenait à aujourd'hui", () => {
  expect(journalForDay(status, "2026-10-03")).toBeNull();
  expect(journalForDay(status, "2026-10-02")).toBe(status?.journal);
});
