import {
  EcartTrajectoire,
  TrajectoirePlan,
  evaluerEcart,
} from './measurement-trajectory';

/**
 * Statut de suivi du poids affiche a l'utilisateur (FR403-675), calcule a
 * partir de la derniere mesure VALIDE du plan actif (les mesures suspecte et
 * hors-plan sont ignorees pour le suivi).
 */
export type StatutSuivi =
  | 'en-attente-premiere-mesure'
  | 'pas-de-donnees-recentes'
  | 'dans-les-clous'
  | 'ecart-detecte';

export interface DerniereValide {
  jourUtc: string;
  poidsKg: number;
}

export interface SuiviInput {
  plan: TrajectoirePlan;
  /** Jour UTC courant (AAAA-MM-JJ), fourni par l'appelant (horloge serveur). */
  jourCourantUtc: string;
  derniereValide: DerniereValide | null;
}

export interface Suivi {
  statut: StatutSuivi;
  /** Ecart de trajectoire, present uniquement pour un suivi a jour. */
  ecart: EcartTrajectoire | null;
}

const joursEntre = (debutJourUtc: string, finJourUtc: string): number =>
  (Date.parse(`${finJourUtc}T00:00:00Z`) -
    Date.parse(`${debutJourUtc}T00:00:00Z`)) /
  86_400_000;

/**
 * Regles FR403-675 :
 * - aucune mesure valide -> en-attente-premiere-mesure.
 * - derniere valide datee d'avant-hier ou avant -> pas-de-donnees-recentes.
 * - datee d'aujourd'hui ou hier -> ecart calcule : dans-les-clous si
 *   |ecart| <= 1 kg (FR403-673), sinon ecart-detecte.
 */
export function determinerSuivi(input: SuiviInput): Suivi {
  if (!input.derniereValide) {
    return { statut: 'en-attente-premiere-mesure', ecart: null };
  }
  const anciennete = joursEntre(
    input.derniereValide.jourUtc,
    input.jourCourantUtc,
  );
  if (anciennete > 1) {
    return { statut: 'pas-de-donnees-recentes', ecart: null };
  }
  const ecart = evaluerEcart(
    input.plan,
    input.derniereValide.jourUtc,
    input.derniereValide.poidsKg,
  );
  return {
    statut: ecart.dansLesClous ? 'dans-les-clous' : 'ecart-detecte',
    ecart,
  };
}
