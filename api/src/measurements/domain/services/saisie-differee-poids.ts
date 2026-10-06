/**
 * Une saisie manuelle du poids est un secours *du jour* (FR403-670). Saisie
 * hors ligne, elle n'est donc rejouée que si elle arrive au serveur le même
 * jour UTC. Le serveur reste l'horloge de référence : la mesure est horodatée
 * à sa réception, jamais avec l'heure de l'appareil.
 */
export const TOLERANCE_HORLOGE_POIDS_MS = 5 * 60 * 1000;

export type RefusSaisiePoids = 'saisie-poids-expiree' | 'saisie-dans-le-futur';

export function verifierSaisieDiffereePoids(
  saisiLe: Date,
  maintenant: Date,
): RefusSaisiePoids | null {
  if (
    !Number.isFinite(saisiLe.getTime()) ||
    saisiLe.getTime() > maintenant.getTime() + TOLERANCE_HORLOGE_POIDS_MS
  ) {
    return 'saisie-dans-le-futur';
  }
  return saisiLe.toISOString().slice(0, 10) ===
    maintenant.toISOString().slice(0, 10)
    ? null
    : 'saisie-poids-expiree';
}
