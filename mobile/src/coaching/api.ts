import { z } from "zod";
import { measurementSchema, weightTrackingSchema } from "../measurements/api";
import { macroTargetsSchema } from "../nutrition/api";
import { clientSchema, requestApi } from "../plans/api";

const foodStatusSchema = z.enum(["dans-le-budget", "depassement", "pas-de-donnees-recentes"]);

export const clientOverviewSchema = clientSchema.extend({
  suiviPoids: weightTrackingSchema,
  alimentation: z.object({ statut: foodStatusSchema, ecartKcal: z.number().nullable() }).nullable(),
});

export const jourCaloriqueSchema = z.object({
  jourUtc: z.string(),
  totalCaloriesKcal: z.number(),
  totalProteinesG: z.number(),
  totalGlucidesG: z.number(),
  totalLipidesG: z.number(),
  nombreEntrees: z.number(),
  ecartKcal: z.number().nullable(),
  statut: z.enum(["dans-le-budget", "depassement", "aucune-entree"]),
});

export const clientProgressionSchema = z.object({
  utilisateur: clientSchema,
  suiviPoids: weightTrackingSchema,
  mesures: z.array(measurementSchema),
  alimentation: z
    .object({
      statut: foodStatusSchema,
      ecartKcal: z.number().nullable(),
      budgetCalorique: z.number(),
      ciblesMacros: macroTargetsSchema,
      jours: z.array(jourCaloriqueSchema),
    })
    .nullable(),
});

export type ClientOverview = z.infer<typeof clientOverviewSchema>;
export type ClientProgression = z.infer<typeof clientProgressionSchema>;
export type JourCalorique = z.infer<typeof jourCaloriqueSchema>;

export const clientsOverview = async () =>
  z.array(clientOverviewSchema).parse(await requestApi("/coach/clients"));

export const clientProgression = async (userId: string) =>
  clientProgressionSchema.parse(await requestApi(`/coach/clients/${encodeURIComponent(userId)}`));

/**
 * Niveau d'attention pour trier la liste du coach : 2 = à surveiller (écart,
 * dépassement, plus de données), 1 = en attente (pas de plan, première
 * mesure attendue), 0 = tout va bien.
 */
export function attentionLevel(client: Pick<ClientOverview, "suiviPoids" | "alimentation">): 0 | 1 | 2 {
  const poids = client.suiviPoids?.statut;
  const alimentation = client.alimentation?.statut;
  if (
    poids === "ecart-detecte" || poids === "pas-de-donnees-recentes" ||
    alimentation === "depassement" || alimentation === "pas-de-donnees-recentes"
  ) return 2;
  if (!client.suiviPoids || poids === "en-attente-premiere-mesure") return 1;
  return 0;
}

/** Les utilisateurs à surveiller d'abord, puis par e-mail. */
export function sortForCoach<T extends ClientOverview>(clients: T[]): T[] {
  return [...clients].sort(
    (a, b) => attentionLevel(b) - attentionLevel(a) || a.email.localeCompare(b.email, "fr"),
  );
}
