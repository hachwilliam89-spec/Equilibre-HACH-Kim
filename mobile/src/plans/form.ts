import { z } from "zod";
const positive = z.string().trim().transform((value) => Number(value.replace(",", "."))).pipe(z.number().positive("Saisissez une valeur positive."));
export const goalsSchema = z.object({
  poidsDepart: positive,
  poidsCible: positive,
  dateDebut: z.iso.date("Utilisez une date valide au format AAAA-MM-JJ."),
  dateCible: z.iso.date("Utilisez une date valide au format AAAA-MM-JJ."),
}).refine((d) => d.dateCible > d.dateDebut, { path: ["dateCible"], message: "La date cible doit suivre la date de début." })
.refine((d) => d.poidsCible !== d.poidsDepart, { path: ["poidsCible"], message: "Le poids cible doit différer du poids de départ." });
export const budgetSchema = positive;
export function weeklyRate(depart: number, cible: number, start: string, end: string) {
  return Math.abs(cible - depart) * 7 * 86400000 / (Date.parse(end) - Date.parse(start));
}
