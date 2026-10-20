import type { NiveauActivite } from '../../../plans/domain/services/metabolic-calculations';

/** Nombre de pas maximal accepté pour une journée (au-delà : valeur aberrante). */
export const PAS_MAX_PAR_JOUR = 50_000;

/** Nombre de jours pris en compte pour la moyenne d'activité. */
export const JOURS_MOYENNE_ACTIVITE = 7;

const JOUR_MS = 86_400_000;

/** Total de pas d'une journée UTC, transmis par la montre. */
export interface PasQuotidien {
  jourUtc: string;
  nombrePas: number;
  recuLe: Date;
}

export interface MoyenneActivite {
  /** Premier et dernier jour UTC de la fenêtre (la veille du calcul incluse). */
  debut: string;
  fin: string;
  joursRenseignes: number;
  /** Moyenne arrondie au pas, ou null si la fenêtre est incomplète. */
  moyennePas: number | null;
  niveau: NiveauActivite | null;
}

/** Paliers de l'US1 : bornes basses incluses. */
export function niveauDepuisMoyenne(moyennePas: number): NiveauActivite {
  if (moyennePas >= 10_000) return 'athlete';
  if (moyennePas >= 7_500) return 'sportif';
  if (moyennePas >= 5_000) return 'actif';
  return 'sedentaire';
}

export function decalerJourUtc(jourUtc: string, jours: number): string {
  const date = Date.parse(`${jourUtc}T00:00:00.000Z`) + jours * JOUR_MS;
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Moyenne des 7 jours qui précèdent le jour du calcul (journée en cours
 * exclue : elle n'est pas terminée). Sans les 7 journées renseignées, aucune
 * déduction : le coach choisit le niveau.
 */
export function moyenneSeptJours(
  pas: readonly PasQuotidien[],
  jourCalculUtc: string,
): MoyenneActivite {
  const debut = decalerJourUtc(jourCalculUtc, -JOURS_MOYENNE_ACTIVITE);
  const fin = decalerJourUtc(jourCalculUtc, -1);
  const fenetre = pas.filter(
    (jour) => jour.jourUtc >= debut && jour.jourUtc <= fin,
  );
  if (fenetre.length < JOURS_MOYENNE_ACTIVITE) {
    return {
      debut,
      fin,
      joursRenseignes: fenetre.length,
      moyennePas: null,
      niveau: null,
    };
  }
  const total = fenetre.reduce((somme, jour) => somme + jour.nombrePas, 0);
  const moyenne = total / JOURS_MOYENNE_ACTIVITE;
  return {
    debut,
    fin,
    joursRenseignes: fenetre.length,
    moyennePas: Math.round(moyenne),
    niveau: niveauDepuisMoyenne(moyenne),
  };
}
