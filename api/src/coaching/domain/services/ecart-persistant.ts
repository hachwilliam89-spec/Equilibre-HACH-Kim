import type { MeasurementProps } from '../../../measurements/domain/entities/measurement.entity';
import { evaluerEcart } from '../../../measurements/domain/services/measurement-trajectory';
import { TOLERANCE_KCAL } from '../../../nutrition/domain/services/food-budget-status';
import type { PlanProps } from '../../../plans/domain/entities/plan.entity';

/** Nombre de valeurs valides consécutives hors tolérance qui déclenche l'alerte. */
export const SEUIL_ECART_PERSISTANT = 3;

export type MetriqueSuivie = 'poids' | 'calories';

/** Une valeur suivie : pesée valide ou journée alimentaire clôturée. */
export interface PointSuivi {
  /** Jour UTC de la valeur. */
  jourUtc: string;
  /** Écart signé (kg pour le poids, kcal pour les calories). */
  ecart: number;
  horsTolerance: boolean;
}

export interface AlerteEcartPersistant {
  metrique: MetriqueSuivie;
  /** Longueur de la série en cours, au moins SEUIL_ECART_PERSISTANT. */
  serie: number;
  /** Premier jour de la série. */
  depuis: string;
  derniere: PointSuivi;
}

/** Journée alimentaire réduite à ce qui sert à la règle. */
export interface JourneeAlimentaire {
  planId: string;
  jourUtc: string;
  budgetCalorique: number;
  totalCaloriesKcal: number;
  nombreEntrees: number;
}

/**
 * Règle unique pour les deux métriques (US5) : la série des dernières
 * valeurs hors tolérance, interrompue par la première valeur dans la
 * tolérance en remontant le temps. Les valeurs à ignorer (pesée suspecte,
 * journée sans entrée) ne sont jamais transmises : elles n'incrémentent ni
 * ne cassent la série.
 */
export function alertePersistante(
  metrique: MetriqueSuivie,
  points: readonly PointSuivi[],
): AlerteEcartPersistant | null {
  const tries = [...points].sort((a, b) => a.jourUtc.localeCompare(b.jourUtc));
  const serie: PointSuivi[] = [];
  for (let index = tries.length - 1; index >= 0; index -= 1) {
    if (!tries[index].horsTolerance) break;
    serie.unshift(tries[index]);
  }
  if (serie.length < SEUIL_ECART_PERSISTANT) return null;
  return {
    metrique,
    serie: serie.length,
    depuis: serie[0].jourUtc,
    derniere: serie[serie.length - 1],
  };
}

/**
 * Pesées prises en compte : mesures « valide » du plan actif, reçues après
 * le dernier ajustement de l'objectif. Les mesures suspectes et hors-plan
 * sont écartées. Tolérance : ± 1 kg autour de la trajectoire.
 */
export function pointsPoids(
  plan: PlanProps,
  mesures: readonly MeasurementProps[],
): PointSuivi[] {
  const depuis = plan.poidsAjusteLe?.getTime() ?? -Infinity;
  return mesures
    .filter(
      (mesure) =>
        mesure.planId === plan.id &&
        mesure.statut === 'valide' &&
        mesure.receivedAt.getTime() > depuis,
    )
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    .map((mesure) => {
      const ecart = evaluerEcart(plan, mesure.jourUtc, mesure.poidsKg);
      return {
        jourUtc: mesure.jourUtc,
        ecart: Math.round(ecart.ecartKg * 100) / 100,
        horsTolerance: !ecart.dansLesClous,
      };
    });
}

/**
 * Journées prises en compte : journées clôturées (avant aujourd'hui) du plan
 * actif avec au moins une entrée, postérieures au jour du dernier ajustement
 * du budget. Hors tolérance au-delà de budget + 150 kcal (règle de l'US3).
 */
export function pointsCalories(
  plan: PlanProps,
  journees: readonly JourneeAlimentaire[],
  jourCourantUtc: string,
): PointSuivi[] {
  const jourAjustement = plan.budgetAjusteLe?.toISOString().slice(0, 10);
  return journees
    .filter(
      (journee) =>
        journee.planId === plan.id &&
        journee.nombreEntrees > 0 &&
        journee.jourUtc < jourCourantUtc &&
        (!jourAjustement || journee.jourUtc > jourAjustement),
    )
    .map((journee) => {
      const ecart =
        Math.round(
          (journee.totalCaloriesKcal - journee.budgetCalorique) * 100,
        ) / 100;
      return {
        jourUtc: journee.jourUtc,
        ecart,
        horsTolerance: ecart > TOLERANCE_KCAL,
      };
    });
}
