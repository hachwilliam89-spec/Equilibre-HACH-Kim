/**
 * Règles d'acceptation d'une entrée alimentaire saisie hors ligne puis
 * transmise plus tard par la synchronisation (FR403 - synchronisation).
 *
 * En ligne, le serveur horodate lui-même l'entrée. Hors ligne, l'heure de
 * consommation vient de l'appareil : on l'accepte, mais dans une fenêtre
 * bornée pour qu'une horloge fausse ou une file d'attente très ancienne ne
 * puisse pas réécrire l'historique.
 */
export const TOLERANCE_HORLOGE_MS = 5 * 60 * 1000;
export const ANCIENNETE_MAX_JOURS = 7;
const JOUR_MS = 86_400_000;

export type RefusSaisieDifferee =
  'saisie-dans-le-futur' | 'saisie-trop-ancienne' | 'saisie-hors-plan';

export interface PeriodePlan {
  dateDebut: Date;
  dateCible: Date;
}

const jourUtc = (date: Date) => date.toISOString().slice(0, 10);

export function verifierSaisieDiffereeAliment(
  consommeLe: Date,
  maintenant: Date,
  plan: PeriodePlan,
): RefusSaisieDifferee | null {
  if (!Number.isFinite(consommeLe.getTime())) return 'saisie-dans-le-futur';
  if (consommeLe.getTime() > maintenant.getTime() + TOLERANCE_HORLOGE_MS) {
    return 'saisie-dans-le-futur';
  }
  const ecartJours =
    (Date.parse(`${jourUtc(maintenant)}T00:00:00Z`) -
      Date.parse(`${jourUtc(consommeLe)}T00:00:00Z`)) /
    JOUR_MS;
  if (ecartJours > ANCIENNETE_MAX_JOURS) return 'saisie-trop-ancienne';
  const jour = jourUtc(consommeLe);
  if (jour < jourUtc(plan.dateDebut) || jour > jourUtc(plan.dateCible)) {
    return 'saisie-hors-plan';
  }
  return null;
}

/**
 * Le serveur ne date jamais une entrée dans le futur : une avance d'horloge
 * tolérée est ramenée à l'instant de réception.
 */
export function horodatageRetenu(consommeLe: Date, maintenant: Date): Date {
  return consommeLe.getTime() > maintenant.getTime()
    ? new Date(maintenant)
    : new Date(consommeLe);
}
