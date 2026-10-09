import { z } from "zod";
import { parseApiData } from "../network/http";
import { measurementSchema, weightTrackingSchema } from "../measurements/api";
import { macroTargetsSchema } from "../nutrition/api";
import { clientSchema, requestApi } from "../plans/api";
import { hasIdentity } from "../identity/identity";

const foodStatusSchema = z.enum(["dans-le-budget", "depassement", "pas-de-donnees-recentes"]);

export const clientOverviewSchema = clientSchema.extend({
  suiviPoids: weightTrackingSchema,
  alimentation: z.object({ statut: foodStatusSchema, ecartKcal: z.number().nullable() }).nullable(),
  /** Dernière pesée ou saisie ; absent sur une API antérieure. */
  derniereActivite: z.string().nullable().optional(),
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
  parseApiData(z.array(clientOverviewSchema), await requestApi("/coach/clients"));

export const clientProgression = async (userId: string) =>
  parseApiData(clientProgressionSchema, await requestApi(`/coach/clients/${encodeURIComponent(userId)}`));

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

/** Les utilisateurs à surveiller d'abord, puis par nom (e-mail pour un ancien compte). */
export function sortForCoach<T extends ClientOverview>(clients: T[]): T[] {
  const key = (client: T) => (hasIdentity(client) ? `${client.nom} ${client.prenom}` : client.email);
  return [...clients].sort(
    (a, b) => attentionLevel(b) - attentionLevel(a) || key(a).localeCompare(key(b), "fr", { sensitivity: "base" }),
  );
}

export type CoachAction = "revoir-plan" | "relancer" | "creer-plan" | "attendre-pesee";

export interface CoachAlert {
  /** Pourquoi regarder cet utilisateur, en une phrase. */
  raison: string;
  /** Ce que le coach peut faire. */
  action: CoachAction;
}

export const coachActionLabel: Record<CoachAction, string> = {
  "revoir-plan": "Examiner le suivi et le plan",
  relancer: "Faire le point avec l’utilisateur",
  "creer-plan": "Créer un plan",
  "attendre-pesee": "Attendre la première pesée",
};

const kg = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")} kg`;
const kcal = (value: number) => `${Math.round(value).toLocaleString("fr-FR")} kcal`;

/**
 * Raisons concrètes de regarder un utilisateur, les plus urgentes d'abord :
 * écart réel (poids, calories) avant absence de données, puis attente.
 * Liste vide = rien à faire.
 */
export function coachAlerts(client: Pick<ClientOverview, "suiviPoids" | "alimentation">): CoachAlert[] {
  const poids = client.suiviPoids;
  const alimentation = client.alimentation;
  if (!poids) return [{ raison: "Aucun plan actif", action: "creer-plan" }];
  const alerts: CoachAlert[] = [];
  if (poids.statut === "ecart-detecte") {
    alerts.push({
      raison: poids.ecartKg !== null
        ? `Poids à ${kg(poids.ecartKg)} de la trajectoire`
        : "Poids hors de la trajectoire",
      action: "revoir-plan",
    });
  }
  if (alimentation?.statut === "depassement") {
    alerts.push({
      raison: alimentation.ecartKcal !== null
        ? `Calories au-dessus du budget (+${kcal(alimentation.ecartKcal)})`
        : "Calories au-dessus du budget",
      action: "revoir-plan",
    });
  }
  if (poids.statut === "pas-de-donnees-recentes") {
    alerts.push({ raison: "Aucune pesée récente", action: "relancer" });
  }
  if (alimentation?.statut === "pas-de-donnees-recentes") {
    alerts.push({ raison: "Aucun repas saisi depuis 2 jours", action: "relancer" });
  }
  if (poids.statut === "en-attente-premiere-mesure") {
    alerts.push({ raison: "Plan démarré, première pesée attendue", action: "attendre-pesee" });
  }
  return alerts;
}
