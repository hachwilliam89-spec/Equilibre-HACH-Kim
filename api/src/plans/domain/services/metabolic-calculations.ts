/**
 * Fonctions métier pures (US1 — création de plan).
 * Aucune dépendance NestJS/Mongoose : testables en TypeScript pur, sans mock
 * ni base de données (conformément au cahier des charges).
 */

export type Sexe = 'homme' | 'femme';

export type NiveauActivite = 'sedentaire' | 'actif' | 'sportif' | 'athlete';

/** Facteur multiplicateur du BMR par niveau d'activité (US1, palier saisi
 * manuellement par le coach tant que US4 — déduction automatique via montre
 * connectée simulée — n'est pas implémentée). */
export const ACTIVITY_FACTORS: Record<NiveauActivite, number> = {
  sedentaire: 1.2,
  actif: 1.375,
  sportif: 1.55,
  athlete: 1.725,
};

/** Équivalence énergétique utilisée pour convertir un rythme de variation de
 * poids (kg/semaine) en déficit/surplus calorique quotidien. */
const KCAL_PAR_KG = 7700;

const JOURS_PAR_SEMAINE = 7;

/** IMC = poids (kg) / taille (m)². */
export function calculateImc(poidsKg: number, tailleCm: number): number {
  const tailleM = tailleCm / 100;
  return poidsKg / (tailleM * tailleM);
}

/**
 * Rythme hebdomadaire de variation de poids impliqué par un plan.
 * Positif en prise de masse, négatif en perte — l'appelant applique la
 * borne (1 kg/semaine perte, 0.5 kg/semaine prise) selon le signe.
 */
export function calculateWeeklyRateKgPerWeek(
  poidsDepart: number,
  poidsCible: number,
  dateDebut: Date,
  dateCible: Date,
): number {
  const joursTotal =
    (dateCible.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24);
  const semaines = joursTotal / JOURS_PAR_SEMAINE;
  return (poidsCible - poidsDepart) / semaines;
}

export interface CalculateBmrInput {
  sexe: Sexe;
  poidsKg: number;
  tailleCm: number;
  age: number;
}

/** Métabolisme de base (BMR) — formule de Mifflin-St Jeor. */
export function calculateBmr({
  sexe,
  poidsKg,
  tailleCm,
  age,
}: CalculateBmrInput): number {
  const base = 10 * poidsKg + 6.25 * tailleCm - 5 * age;
  return sexe === 'homme' ? base + 5 : base - 161;
}

export interface CalculateCalorieBudgetInput {
  bmr: number;
  niveauActivite: NiveauActivite;
  /** Rythme hebdo signé (positif = prise de masse, négatif = perte). */
  rythmeKgParSemaine: number;
  /** Valeur saisie par le coach : prévaut sur la suggestion, jamais
   * plafonnée automatiquement (choix explicite du coach). */
  coachOverride?: number;
}

export interface CalorieBudgetResult {
  tdee: number;
  budgetSuggere: number;
  /** Valeur finale retenue (override du coach si fourni, sinon suggestion). */
  budget: number;
  /** true si le budget suggéré a dû être plafonné au BMR. Toujours false si
   * le coach a fourni une valeur explicite (non plafonnée). */
  budgetPlafonneAuBmr: boolean;
}

/**
 * Budget calorique suggéré, dérivé du rythme réel du plan de poids (pas une
 * valeur fixe) : TDEE ± (rythme converti en kcal/jour via 7700 kcal/kg),
 * jamais suggéré sous le BMR (plancher de sécurité nutritionnel).
 */
export function calculateCalorieBudget({
  bmr,
  niveauActivite,
  rythmeKgParSemaine,
  coachOverride,
}: CalculateCalorieBudgetInput): CalorieBudgetResult {
  const tdee = bmr * ACTIVITY_FACTORS[niveauActivite];
  const deltaQuotidien = (rythmeKgParSemaine * KCAL_PAR_KG) / JOURS_PAR_SEMAINE;
  const budgetSuggereBrut = tdee + deltaQuotidien;
  const budgetPlafonneAuBmr = budgetSuggereBrut < bmr;
  const budgetSuggere = budgetPlafonneAuBmr ? bmr : budgetSuggereBrut;

  return {
    tdee,
    budgetSuggere,
    budget: coachOverride ?? budgetSuggere,
    budgetPlafonneAuBmr:
      coachOverride !== undefined ? false : budgetPlafonneAuBmr,
  };
}
