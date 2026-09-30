import { z } from "zod";
import { requestApi } from "../plans/api";

export const measurementSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planId: z.string(),
  poidsKg: z.number().positive(),
  receivedAt: z.string(),
  jourUtc: z.string(),
  source: z.enum(["automatique", "manuelle"]),
  statut: z.enum(["valide", "suspecte", "hors-plan"]),
});

const planResumeSchema = z.object({
  id: z.string(),
  poidsDepart: z.number(),
  poidsCible: z.number(),
  dateDebut: z.string(),
  dateCible: z.string(),
  imcCible: z.number(),
  niveauActivite: z.enum(["sedentaire", "actif", "sportif", "athlete"]),
  budgetCalorique: z.number(),
  budgetPlafonneAuBmr: z.boolean(),
  statut: z.enum(["actif", "termine", "annule"]),
});

export const weightTrackingSchema = z
  .object({
    statut: z.enum([
      "en-attente-premiere-mesure",
      "pas-de-donnees-recentes",
      "dans-les-clous",
      "ecart-detecte",
    ]),
    plan: planResumeSchema,
    derniereMesure: measurementSchema.nullable(),
    poidsAttendu: z.number().nullable(),
    ecartKg: z.number().nullable(),
  })
  .nullable();

export type Measurement = z.infer<typeof measurementSchema>;
export type WeightTracking = z.infer<typeof weightTrackingSchema>;

export async function getWeightTracking(): Promise<WeightTracking> {
  return weightTrackingSchema.parse(
    await requestApi("/measurements/me/suivi"),
  );
}

export async function getMeasurementHistory(): Promise<Measurement[]> {
  return z
    .array(measurementSchema)
    .parse(await requestApi("/measurements/me"));
}
