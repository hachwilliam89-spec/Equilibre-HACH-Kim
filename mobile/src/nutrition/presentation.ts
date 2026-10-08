import type {
  FoodBudgetStatus,
  FoodEntry,
  FoodJournal,
  MealCategory,
  ReferenceFood,
  FoodCategory,
} from "./api";

export const mealCategories: { value: MealCategory; label: string }[] = [
  { value: "petit-dejeuner", label: "Petit-déjeuner" },
  { value: "dejeuner", label: "Déjeuner" },
  { value: "diner", label: "Dîner" },
  { value: "collation", label: "Collation" },
];

export const foodCategories: { value: FoodCategory; label: string }[] = [
  { value: "feculents", label: "Féculents" },
  { value: "legumineuses", label: "Légumineuses" },
  { value: "viandes", label: "Viandes" },
  { value: "poissons", label: "Poissons" },
  { value: "oeufs", label: "Œufs" },
  { value: "legumes", label: "Légumes" },
  { value: "fruits", label: "Fruits" },
  { value: "produits-laitiers", label: "Produits laitiers" },
  { value: "autres", label: "Autres" },
];

export function groupEntriesByMeal<T extends FoodEntry>(entries: T[]) {
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

type QuickPortion = { label: string; grams: number };

const HOUSEHOLD_UNITS: { pattern: RegExp; label: string; grams: number }[] = [
  { pattern: /blanc d.{0,2}oeuf/, label: "1 blanc", grams: 33 },
  { pattern: /jaune d.{0,2}oeuf/, label: "1 jaune", grams: 17 },
  { pattern: /oeuf/, label: "1 œuf", grams: 50 },
  { pattern: /banane/, label: "1 banane", grams: 120 },
  { pattern: /\bpomme\b/, label: "1 pomme", grams: 150 },
  { pattern: /poire/, label: "1 poire", grams: 150 },
  { pattern: /peche/, label: "1 pêche", grams: 150 },
  { pattern: /orange/, label: "1 orange", grams: 130 },
  { pattern: /clementine/, label: "1 clémentine", grams: 80 },
  { pattern: /kiwi/, label: "1 kiwi", grams: 75 },
  { pattern: /pain de mie/, label: "1 tranche", grams: 30 },
  { pattern: /baguette/, label: "1/4", grams: 65 },
  { pattern: /yaourt|skyr|fromage blanc/, label: "1 pot", grams: 125 },
  { pattern: /tomate/, label: "1 tomate", grams: 120 },
  { pattern: /carotte/, label: "1 carotte", grams: 70 },
];

const normalizePortion = (name: string) => name.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/œ/g, "oe");

/** Portion proposée par défaut : l'unité ménagère connue, sinon 100 g. */
export function defaultPortion(food: ReferenceFood): number {
  const value = normalizePortion(food.nom);
  return HOUSEHOLD_UNITS.find((u) => u.pattern.test(value))?.grams ?? 100;
}

/**
 * Repas proposé selon l'heure locale de la saisie. L'utilisateur peut
 * toujours en choisir un autre : ce n'est qu'une présélection.
 */
export function suggestedMeal(hour: number): Exclude<MealCategory, "non-classe"> {
  if (hour >= 5 && hour < 11) return "petit-dejeuner";
  if (hour >= 11 && hour < 15) return "dejeuner";
  if (hour >= 18 && hour < 23) return "diner";
  return "collation";
}

/** Suggestions de portions pour eviter la saisie au gramme pres. */
export function quickPortions(food: ReferenceFood): QuickPortion[] {
  const value = normalizePortion(food.nom);
  const unit = HOUSEHOLD_UNITS.find((u) => u.pattern.test(value));
  const portions: QuickPortion[] = unit
    ? [{ label: `${unit.label} · ${unit.grams} g`, grams: unit.grams }]
    : [];
  for (const g of [50, 100, 150, 200]) {
    if (!portions.some((p) => p.grams === g)) portions.push({ label: `${g} g`, grams: g });
  }
  return portions.slice(0, 5);
}

/**
 * Valeurs pour 100 g retrouvées depuis une entrée du journal, pour ré-ajouter
 * l'aliment (annulation d'un retrait) sans consulter le référentiel.
 */
export function referenceFoodFromEntry(entry: FoodEntry): ReferenceFood {
  const per100 = (value: number) =>
    entry.quantiteGrammes > 0 ? Math.round((value / entry.quantiteGrammes) * 10000) / 100 : 0;
  return {
    id: entry.foodId,
    nom: entry.nom,
    categorie: "autres",
    caloriesKcalPour100g: per100(entry.caloriesKcal),
    proteinesGPour100g: per100(entry.proteinesG),
    glucidesGPour100g: per100(entry.glucidesG),
    lipidesGPour100g: per100(entry.lipidesG),
  };
}
