import { dailyBudgetPresentation, journalForDay } from "../presentation";
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

it("distingue la cible, la tolérance incluse et le dépassement", () => {
  expect(dailyBudgetPresentation(1750, 1800, true).note).toContain("50 kcal restantes");
  expect(dailyBudgetPresentation(1950, 1800, true)).toMatchObject({
    overTolerance: false,
    consumedPercent: 100,
  });
  expect(dailyBudgetPresentation(1950, 1800, true).note).toContain("dans la tolérance");
  expect(dailyBudgetPresentation(1951, 1800, true)).toMatchObject({
    overTolerance: true,
    consumedPercent: 100,
  });
  expect(dailyBudgetPresentation(1951, 1800, true).targetPercent).toBeLessThan(100);
});

it("ne présente pas un jour vide comme une consommation confirmée", () => {
  const display = dailyBudgetPresentation(0, 1800, false);
  expect(display.note).toBe("Aucune entrée consignée aujourd’hui.");
  expect(display.consumedPercent).toBe(0);
});
