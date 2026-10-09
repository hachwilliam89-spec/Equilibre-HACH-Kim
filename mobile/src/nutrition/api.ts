import { z } from "zod";
import { parseApiData } from "../network/http";
import { requestApi } from "../plans/api";

export const mealCategorySchema = z.enum([
  "petit-dejeuner",
  "dejeuner",
  "diner",
  "collation",
  "non-classe",
]);

export const foodEntrySchema = z.object({
  id: z.string(),
  foodId: z.string(),
  nom: z.string(),
  quantiteGrammes: z.number(),
  caloriesKcal: z.number(),
  proteinesG: z.number(),
  glucidesG: z.number(),
  lipidesG: z.number(),
  categorieRepas: mealCategorySchema.default("non-classe"),
  receivedAt: z.string(),
});

export const referenceFoodSchema = z.object({
  id: z.string(),
  nom: z.string(),
  categorie: z.enum([
    "feculents", "legumineuses", "viandes", "poissons", "oeufs",
    "legumes", "fruits", "produits-laitiers", "autres",
  ]),
  caloriesKcalPour100g: z.number(),
  proteinesGPour100g: z.number(),
  glucidesGPour100g: z.number(),
  lipidesGPour100g: z.number(),
});

export const foodJournalSchema = z.object({
  planId: z.string(),
  jourUtc: z.string(),
  budgetCalorique: z.number(),
  entrees: z.array(foodEntrySchema),
  totalCaloriesKcal: z.number(),
  totalProteinesG: z.number(),
  totalGlucidesG: z.number(),
  totalLipidesG: z.number(),
});

export const macroTargetsSchema = z.object({
  proteinesG: z.number(),
  glucidesG: z.number(),
  lipidesG: z.number(),
});

export const foodBudgetStatusSchema = z
  .object({
    statut: z.enum([
      "dans-le-budget",
      "depassement",
      "pas-de-donnees-recentes",
    ]),
    budgetCalorique: z.number(),
    ciblesMacros: macroTargetsSchema.nullish(),
    ecartKcal: z.number().nullable(),
    journal: foodJournalSchema.nullable(),
  })
  .nullable();

export type FoodJournal = z.infer<typeof foodJournalSchema>;
export type FoodEntry = z.infer<typeof foodEntrySchema>;
export type MealCategory = z.infer<typeof mealCategorySchema>;
export type FoodBudgetStatus = z.infer<typeof foodBudgetStatusSchema>;
export type MacroTargets = z.infer<typeof macroTargetsSchema>;
export type ReferenceFood = z.infer<typeof referenceFoodSchema>;
export type FoodCategory = ReferenceFood["categorie"];

export async function getFoodBudgetStatus(): Promise<FoodBudgetStatus> {
  return parseApiData(foodBudgetStatusSchema,
    await requestApi("/food-journals/me/status"),
  );
}

export async function searchReferenceFoods(query: string, category?: FoodCategory, page = 1): Promise<ReferenceFood[]> {
  const params = `q=${encodeURIComponent(query.trim())}&size=50&page=${page}` +
    (category ? `&categorie=${encodeURIComponent(category)}` : "");
  return parseApiData(z.array(referenceFoodSchema),
    await requestApi(`/foods?${params}`),
  );
}

export async function getFavoriteFoods(): Promise<ReferenceFood[]> {
  return parseApiData(z.array(referenceFoodSchema), await requestApi("/foods/me/favorites"));
}

export async function setFavoriteFood(foodId: string, favorite: boolean): Promise<void> {
  await requestApi(`/foods/me/favorites/${encodeURIComponent(foodId)}`, favorite ? "PUT" : "DELETE");
}

export async function addFoodEntry(
  foodId: string,
  quantiteGrammes: number,
  categorieRepas?: MealCategory,
): Promise<FoodJournal> {
  return parseApiData(foodJournalSchema,
    await requestApi("/food-journals/me/entries", "POST", {
      foodId,
      quantiteGrammes,
      ...(categorieRepas ? { categorieRepas } : {}),
    }),
  );
}

export async function removeFoodEntry(entryId: string): Promise<FoodJournal> {
  return parseApiData(foodJournalSchema,
    await requestApi(`/food-journals/me/entries/${encodeURIComponent(entryId)}`, "DELETE"),
  );
}
