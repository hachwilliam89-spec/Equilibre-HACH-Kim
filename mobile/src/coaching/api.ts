import { z } from "zod";
import { parseApiData } from "../network/http";
import { measurementSchema, weightTrackingSchema } from "../measurements/api";
import { macroTargetsSchema } from "../nutrition/api";
import { clientSchema, requestApi } from "../plans/api";
import { hasIdentity } from "../identity/identity";
import { moyenneActiviteSchema } from "../activity/api";

const foodStatusSchema = z.enum(["dans-le-budget", "depassement", "pas-de-donnees-recentes"]);

/** Écart persistant (US5) : 3 valeurs valides consécutives hors tolérance. */
export const alerteEcartSchema = z.object({
  metrique: z.enum(["poids", "calories"]),
  serie: z.number(),
  depuis: z.string(),
  derniere: z.object({ jourUtc: z.string(), ecart: z.number(), horsTolerance: z.boolean() }),
});

export const clientOverviewSchema = clientSchema.extend({
  suiviPoids: weightTrackingSchema,
  alimentation: z.object({ statut: foodStatusSchema, ecartKcal: z.number().nullable() }).nullable(),
  /** Dernière pesée ou saisie ; absent sur une API antérieure. */
  derniereActivite: z.string().nullable().optional(),
  /** Écarts persistants (US5) ; absents sur une API antérieure. */
  alertes: z.array(alerteEcartSchema).optional(),
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
  /** Moyenne des 7 jours de pas (US4) ; absente sur une API antérieure. */
  activite: moyenneActiviteSchema.optional(),
  /** Écarts persistants (US5) ; absents sur une API antérieure. */
  alertes: z.array(alerteEcartSchema).optional(),
});

export type ClientOverview = z.infer<typeof clientOverviewSchema>;
export type ClientProgression = z.infer<typeof clientProgressionSchema>;
export type JourCalorique = z.infer<typeof jourCaloriqueSchema>;
export type AlerteEcart = z.infer<typeof alerteEcartSchema>;

export const clientsOverview = async () =>
  parseApiData(z.array(clientOverviewSchema), await requestApi("/coach/clients"));

export const clientProgression = async (userId: string) =>
  parseApiData(clientProgressionSchema, await requestApi(`/coach/clients/${encodeURIComponent(userId)}`));

type AttentionInput = Pick<ClientOverview, "suiviPoids" | "alimentation" | "alertes">;

/**
 * Niveau d'attention pour trier la liste du coach : 3 = écart persistant
 * (US5, plan à ajuster), 2 = à surveiller (écart ponctuel, dépassement, plus
 * de données), 1 = en attente (pas de plan, première mesure attendue),
 * 0 = aucune alerte détectée.
 */
export function attentionLevel(client: AttentionInput): 0 | 1 | 2 | 3 {
  if (client.alertes?.length) return 3;
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

export type CoachAction = "ajuster-plan" | "revoir-plan" | "relancer" | "creer-plan" | "attendre-pesee";

export interface CoachAlert {
  /** Pourquoi regarder cet utilisateur, en une phrase. */
  raison: string;
  /** Ce que le coach peut faire. */
  action: CoachAction;
}

export const coachActionLabel: Record<CoachAction, string> = {
  "ajuster-plan": "Ajuster le plan",
  "revoir-plan": "Examiner le suivi et le plan",
  relancer: "Faire le point avec l’utilisateur",
  "creer-plan": "Créer un plan",
  "attendre-pesee": "Attendre la première pesée",
};

const kg = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")} kg`;
const kcal = (value: number) => `${Math.round(value).toLocaleString("fr-FR")} kcal`;

/** Phrase d'une alerte d'écart persistant, avec la dernière valeur. */
export function persistentAlertReason(alerte: AlerteEcart): string {
  return alerte.metrique === "poids"
    ? `Poids hors tolérance sur ${alerte.serie} pesées de suite (${kg(alerte.derniere.ecart)})`
    : `Calories au-delà du budget ${alerte.serie} jours de suite (+${kcal(alerte.derniere.ecart)})`;
}

/**
 * Raisons concrètes de regarder un utilisateur, les plus urgentes d'abord :
 * écart persistant (plan à ajuster), puis écart ponctuel (poids, calories),
 * absence de données, attente. Un écart persistant remplace l'écart ponctuel
 * de la même métrique. Liste vide = rien à faire.
 */
export function coachAlerts(client: AttentionInput): CoachAlert[] {
  const poids = client.suiviPoids;
  const alimentation = client.alimentation;
  if (!poids) return [{ raison: "Aucun plan actif", action: "creer-plan" }];
  const persistantes = client.alertes ?? [];
  const persistant = (metrique: AlerteEcart["metrique"]) => persistantes.some((a) => a.metrique === metrique);
  const alerts: CoachAlert[] = persistantes.map((alerte) => ({
    raison: persistentAlertReason(alerte),
    action: "ajuster-plan",
  }));
  if (poids.statut === "ecart-detecte" && !persistant("poids")) {
    alerts.push({
      raison: poids.ecartKg !== null
        ? `Poids à ${kg(poids.ecartKg)} de la trajectoire`
        : "Poids hors de la trajectoire",
      action: "revoir-plan",
    });
  }
  if (alimentation?.statut === "depassement" && !persistant("calories")) {
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
