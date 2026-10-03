import { z } from "zod";
import { requestApi } from "../plans/api";

export const foodEntrySchema = z.object({
  id: z.string(),
  foodId: z.string(),
  nom: z.string(),
  quantiteGrammes: z.number(),
  caloriesKcal: z.number(),
  proteinesG: z.number(),
  glucidesG: z.number(),
  lipidesG: z.number(),
  receivedAt: z.string(),
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

export const foodBudgetStatusSchema = z
  .object({
    statut: z.enum([
      "dans-le-budget",
      "depassement",
      "pas-de-donnees-recentes",
    ]),
    budgetCalorique: z.number(),
    ecartKcal: z.number().nullable(),
    journal: foodJournalSchema.nullable(),
  })
  .nullable();

export type FoodJournal = z.infer<typeof foodJournalSchema>;
export type FoodEntry = z.infer<typeof foodEntrySchema>;
export type FoodBudgetStatus = z.infer<typeof foodBudgetStatusSchema>;

export async function getFoodBudgetStatus(): Promise<FoodBudgetStatus> {
  return foodBudgetStatusSchema.parse(
    await requestApi("/food-journals/me/status"),
  );
}
