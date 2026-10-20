import { z } from "zod";
import { displayDate } from "../ui/dates";
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

export interface AdjustFields { poidsCible: string; dateCible: string; budget: string }
export type AdjustResult =
  | { ok: true; body: { poidsCible?: number; dateCible?: string; budgetCalorique?: number }; changes: string[] }
  | { ok: false; errors: Partial<Record<keyof AdjustFields | "form", string>> };

const day = (iso: string) => iso.slice(0, 10);
const frKg = (value: number) => `${String(value).replace(".", ",")} kg`;
const frKcal = (value: number) => `${Math.round(value).toLocaleString("fr-FR")} kcal`;

/**
 * Prépare l'ajustement d'un plan actif (US5) : mêmes règles que la création
 * (IMC cible ≥ 18,5, rythme ≤ 1 kg/sem. en perte et 0,5 kg/sem. en prise),
 * date cible ni passée ni avant le début. Seuls les champs modifiés partent ;
 * un budget inchangé est recalculé par l'API si l'objectif change, sauf
 * profil incomplet (âge ou sexe) où le budget saisi est toujours envoyé.
 */
export function adjustmentBody(
  plan: { poidsDepart: number; poidsCible: number; dateDebut: string; dateCible: string; budgetCalorique: number },
  fields: AdjustFields,
  context: { tailleCm?: number; automatic: boolean; today: string },
): AdjustResult {
  const errors: Partial<Record<keyof AdjustFields | "form", string>> = {};
  const poids = positive.safeParse(fields.poidsCible);
  const budget = positive.safeParse(fields.budget);
  const date = z.iso.date().safeParse(fields.dateCible);
  if (!poids.success) errors.poidsCible = "Saisissez un poids cible positif.";
  if (!budget.success) errors.budget = "Saisissez un budget calorique positif.";
  if (!date.success) errors.dateCible = "Choisissez une date cible valide.";
  if (!poids.success || !budget.success || !date.success) return { ok: false, errors };

  const debut = day(plan.dateDebut);
  if (date.data <= debut) errors.dateCible = "La date cible doit suivre la date de début du plan.";
  else if (date.data < context.today) errors.dateCible = "La date cible ne peut pas être passée.";
  if (poids.data === plan.poidsDepart) errors.poidsCible = "Le poids cible doit différer du poids de départ.";
  else if (context.tailleCm && poids.data / (context.tailleCm / 100) ** 2 < 18.5) {
    errors.poidsCible = "L’IMC cible doit être au moins égal à 18,5.";
  }
  if (!errors.dateCible && !errors.poidsCible) {
    const limit = poids.data < plan.poidsDepart ? 1 : 0.5;
    if (weeklyRate(plan.poidsDepart, poids.data, debut, date.data) > limit + 1e-9) {
      errors.dateCible = `Rythme maximal : ${limit} kg/semaine. Allongez la durée ou ajustez l’objectif.`;
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const body: { poidsCible?: number; dateCible?: string; budgetCalorique?: number } = {};
  const changes: string[] = [];
  if (poids.data !== plan.poidsCible) {
    body.poidsCible = poids.data;
    changes.push(`Poids cible : ${frKg(plan.poidsCible)} → ${frKg(poids.data)}`);
  }
  if (date.data !== day(plan.dateCible)) {
    body.dateCible = date.data;
    changes.push(`Date cible : ${displayDate(day(plan.dateCible))} → ${displayDate(date.data)}`);
  }
  const objectif = body.poidsCible !== undefined || body.dateCible !== undefined;
  if (budget.data !== plan.budgetCalorique || (objectif && !context.automatic)) {
    body.budgetCalorique = budget.data;
    changes.push(`Budget : ${frKcal(plan.budgetCalorique)} → ${frKcal(budget.data)} par jour`);
  } else if (objectif) {
    changes.push("Budget : recalculé pour le nouvel objectif");
  }
  if (!changes.length) return { ok: false, errors: { form: "Aucune modification à enregistrer." } };
  return { ok: true, body, changes };
}
