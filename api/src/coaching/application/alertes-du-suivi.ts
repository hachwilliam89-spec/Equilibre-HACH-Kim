import type { Plan } from '../../plans/domain/entities/plan.entity';
import type { Suivi } from '../../suivis/domain/entities/suivi.entity';
import {
  alertePersistante,
  pointsCalories,
  pointsPoids,
  type AlerteEcartPersistant,
} from '../domain/services/ecart-persistant';

/**
 * Alertes d'écart persistant du plan actif (US5), calculées à la lecture à
 * partir du suivi : rien n'est stocké, une alerte disparaît d'elle-même au
 * retour dans la tolérance ou après un ajustement du plan.
 */
export function alertesDuSuivi(
  plan: Plan,
  suivi: Suivi | null,
  jourCourantUtc: string,
): AlerteEcartPersistant[] {
  if (!suivi) return [];
  const planProps = plan.toProps();
  const props = suivi.toProps();
  const poids = alertePersistante(
    'poids',
    pointsPoids(
      planProps,
      props.mesures.map((mesure) => mesure.toProps()),
    ),
  );
  const calories = alertePersistante(
    'calories',
    pointsCalories(
      planProps,
      props.journauxAlimentaires.map((journal) => {
        const journalProps = journal.toProps();
        return {
          planId: journalProps.planId,
          jourUtc: journalProps.jourUtc,
          budgetCalorique: journalProps.budgetCalorique,
          totalCaloriesKcal: journalProps.totalCaloriesKcal,
          nombreEntrees: journalProps.entrees.length,
        };
      }),
      jourCourantUtc,
    ),
  );
  return [poids, calories].filter(
    (alerte): alerte is AlerteEcartPersistant => alerte !== null,
  );
}

export function jourUtc(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
