import { TOLERANCE_KCAL } from '../../../nutrition/domain/services/food-budget-status';

/** Totaux d'une journée, sans le détail des aliments (vue coach). */
export interface TotauxJournaliers {
  jourUtc: string;
  totalCaloriesKcal: number;
  totalProteinesG: number;
  totalGlucidesG: number;
  totalLipidesG: number;
  nombreEntrees: number;
}

export type StatutJour = 'dans-le-budget' | 'depassement' | 'aucune-entree';

export interface JourCalorique extends TotauxJournaliers {
  ecartKcal: number | null;
  statut: StatutJour;
}

export const JOURS_SERIE_COACH = 7;
const JOUR_MS = 86_400_000;

const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;

/**
 * Série des derniers jours (UTC), du plus ancien au plus récent, se terminant
 * à `jourFinUtc`. Un jour sans journal ou sans entrée est présent avec des
 * totaux à 0 : le coach voit les trous de saisie. La règle de statut est celle
 * de l'utilisateur (US3) : dépassement au-delà du budget + 150 kcal.
 */
export function serieCalorique(
  journaux: TotauxJournaliers[],
  budgetCalorique: number,
  jourFinUtc: string,
  nombreJours = JOURS_SERIE_COACH,
): JourCalorique[] {
  const parJour = new Map(
    journaux.map((journal) => [journal.jourUtc, journal]),
  );
  const fin = Date.parse(`${jourFinUtc}T00:00:00Z`);
  return Array.from({ length: nombreJours }, (_, index) => {
    const jourUtc = new Date(fin - (nombreJours - 1 - index) * JOUR_MS)
      .toISOString()
      .slice(0, 10);
    const journal = parJour.get(jourUtc);
    if (!journal || journal.nombreEntrees === 0) {
      return {
        jourUtc,
        totalCaloriesKcal: 0,
        totalProteinesG: 0,
        totalGlucidesG: 0,
        totalLipidesG: 0,
        nombreEntrees: 0,
        ecartKcal: null,
        statut: 'aucune-entree',
      };
    }
    const ecartKcal = arrondi(journal.totalCaloriesKcal - budgetCalorique);
    return {
      ...journal,
      ecartKcal,
      statut: ecartKcal > TOLERANCE_KCAL ? 'depassement' : 'dans-le-budget',
    };
  });
}
