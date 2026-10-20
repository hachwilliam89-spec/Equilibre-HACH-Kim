import { z } from "zod";
import { parseApiData } from "../network/http";
import { requestApi } from "../plans/api";

export const activityLevelSchema = z.enum(["sedentaire", "actif", "sportif", "athlete"]);
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

/** Moyenne des 7 jours précédant aujourd'hui ; niveau null si incomplète. */
export const moyenneActiviteSchema = z.object({
  debut: z.string(),
  fin: z.string(),
  joursRenseignes: z.number(),
  moyennePas: z.number().nullable(),
  niveau: activityLevelSchema.nullable(),
});
export type MoyenneActivite = z.infer<typeof moyenneActiviteSchema>;

export const pasQuotidienSchema = z.object({
  jourUtc: z.string(),
  nombrePas: z.number(),
  recuLe: z.string(),
});
export type PasQuotidien = z.infer<typeof pasQuotidienSchema>;

export const activiteSchema = z.object({
  historique: z.array(pasQuotidienSchema),
  moyenne7Jours: moyenneActiviteSchema,
});
export type Activite = z.infer<typeof activiteSchema>;

export const getActivity = async () =>
  parseApiData(activiteSchema, await requestApi("/activity/me"));
