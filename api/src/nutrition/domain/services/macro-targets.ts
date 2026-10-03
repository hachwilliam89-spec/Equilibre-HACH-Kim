import type { NiveauActivite } from '../../../plans/domain/services/metabolic-calculations';

export type ObjectifPoids = 'perte' | 'maintien' | 'prise';

export interface MacroTargets {
  proteinesG: number;
  glucidesG: number;
  lipidesG: number;
}

/**
 * Proteines (g/kg) par niveau d'activite, valeurs usuelles en nutrition
 * sportive. L'effort entre deux fois dans la cible : indirectement via le
 * budget calorique (TDEE = BMR x facteur d'activite, US1) et directement via
 * ce coefficient.
 */
export const PROTEINES_G_PAR_KG: Record<NiveauActivite, number> = {
  sedentaire: 1.6,
  actif: 1.8,
  sportif: 2.0,
  athlete: 2.2,
};
/** Bonus proteique en perte de poids pour preserver la masse maigre. */
export const BONUS_PROTEINES_PERTE_G_PAR_KG = 0.2;
/** Lipides : max entre 25 % des calories et un plancher hormonal de 0,8 g/kg. */
export const PART_LIPIDES_BUDGET = 0.25;
export const PLANCHER_LIPIDES_G_PAR_KG = 0.8;

const KCAL_PROTEINES = 4;
const KCAL_GLUCIDES = 4;
const KCAL_LIPIDES = 9;

/**
 * Derive une cible de macronutriments a partir du budget calorique du plan
 * (US1), du poids de reference et de l'objectif :
 *  - proteines indexees sur le poids et le niveau d'activite (+0,2 g/kg en perte) ;
 *  - lipides au plancher sante (max 25 % des kcal ou 0,8 g/kg) ;
 *  - glucides en complement des calories restantes.
 * Repere indicatif uniquement : le statut du jour reste calorique (US3).
 */
export function ciblesMacros(input: {
  budgetCalorique: number;
  poidsKg: number;
  objectif: ObjectifPoids;
  niveauActivite: NiveauActivite;
}): MacroTargets {
  const { budgetCalorique, poidsKg, objectif, niveauActivite } = input;
  const protParKg =
    PROTEINES_G_PAR_KG[niveauActivite] +
    (objectif === 'perte' ? BONUS_PROTEINES_PERTE_G_PAR_KG : 0);
  const proteinesG = Math.round(protParKg * poidsKg);
  const lipidesG = Math.round(
    Math.max(
      PLANCHER_LIPIDES_G_PAR_KG * poidsKg,
      (PART_LIPIDES_BUDGET * budgetCalorique) / KCAL_LIPIDES,
    ),
  );
  const caloriesRestantes =
    budgetCalorique - proteinesG * KCAL_PROTEINES - lipidesG * KCAL_LIPIDES;
  const glucidesG = Math.max(0, Math.round(caloriesRestantes / KCAL_GLUCIDES));
  return { proteinesG, glucidesG, lipidesG };
}

/** Objectif deduit du sens de la variation de poids du plan. */
export function objectifDepuisPoids(
  poidsDepart: number,
  poidsCible: number,
): ObjectifPoids {
  if (poidsCible < poidsDepart) return 'perte';
  if (poidsCible > poidsDepart) return 'prise';
  return 'maintien';
}
