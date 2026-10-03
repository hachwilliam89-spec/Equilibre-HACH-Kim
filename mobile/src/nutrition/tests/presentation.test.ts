import {
  dailyBudgetPresentation,
  groupEntriesByMeal,
  journalForDay,
  nutritionForQuantity,
  parseFoodQuantity,
} from "../presentation";
import type { FoodBudgetStatus, FoodEntry } from "../api";

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
  expect(dailyBudgetPresentation(1649, 1800, true)).toMatchObject({
    phase: "progress",
    note: "1 kcal avant la zone cible.",
  });
  expect(dailyBudgetPresentation(1650, 1800, true)).toMatchObject({
    phase: "target",
    zoneStart: 1650,
    zoneEnd: 1950,
  });
  expect(dailyBudgetPresentation(1750, 1800, true).note).toContain("Zone cible atteinte");
  expect(dailyBudgetPresentation(1950, 1800, true)).toMatchObject({
    phase: "target",
    overTolerance: false,
    consumedPercent: 100,
  });
  expect(dailyBudgetPresentation(1951, 1800, true)).toMatchObject({
    phase: "over",
    overTolerance: true,
    consumedPercent: 100,
  });
  expect(dailyBudgetPresentation(1951, 1800, true).targetPercent).toBeLessThan(100);
});

it("ne présente pas un jour vide comme une consommation confirmée", () => {
  const display = dailyBudgetPresentation(0, 1800, false);
  expect(display.note).toBe("Aucune entrée consignée aujourd’hui.");
  expect(display.phase).toBe("empty");
  expect(display.consumedPercent).toBe(0);
});

it("accepte une quantité française et estime calories et macros pour 200 g", () => {
  expect(parseFoodQuantity("200,0")).toBe(200);
  expect(nutritionForQuantity({
    id: "food-1", nom: "Riz blanc cuit",
    categorie: "feculents",
    caloriesKcalPour100g: 130,
    proteinesGPour100g: 2.7,
    glucidesGPour100g: 28,
    lipidesGPour100g: 0.3,
  }, 200)).toEqual({
    caloriesKcal: 260,
    proteinesG: 5.4,
    glucidesG: 56,
    lipidesG: 0.6,
  });
});

it("refuse une quantité vide, nulle, négative ou hors limite", () => {
  for (const invalid of ["", "0", "-1", "1e3", "10001", "1,2,3"]) {
    expect(parseFoodQuantity(invalid)).toBeNull();
  }
});

it("regroupe les aliments par repas sans changer le total calorique journalier", () => {
  const base: FoodEntry = {
    id: "entry-1", foodId: "food-1", nom: "Riz", quantiteGrammes: 100,
    caloriesKcal: 130, proteinesG: 2.7, glucidesG: 28, lipidesG: 0.3,
    categorieRepas: "dejeuner", receivedAt: "2026-10-03T12:00:00Z",
  };
  const groups = groupEntriesByMeal([
    base,
    { ...base, id: "entry-2", categorieRepas: "collation", caloriesKcal: 80 },
    { ...base, id: "entry-3", categorieRepas: "dejeuner", caloriesKcal: 50 },
    { ...base, id: "entry-4", categorieRepas: "non-classe", caloriesKcal: 40 },
  ]);
  expect(groups.map(({ label, caloriesKcal }) => ({ label, caloriesKcal }))).toEqual([
    { label: "Déjeuner", caloriesKcal: 180 },
    { label: "Collation", caloriesKcal: 80 },
    { label: "Non classé", caloriesKcal: 40 },
  ]);
  expect(groups.reduce((total, group) => total + group.caloriesKcal, 0)).toBe(300);
});
