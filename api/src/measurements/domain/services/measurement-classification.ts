import type { MeasurementStatut } from '../entities/measurement.entity';

/**
 * Ecart de poids au-dela duquel une mesure est jugee suspecte, en kg
 * (FR403-672). Une variation quotidienne physiologique normale est de
 * 1 a 2 kg ; au-dela de 3 kg on suspecte une erreur de saisie ou de balance.
 */
export const SEUIL_SUSPECT_KG = 3;

export interface ClassificationInput {
  /** Jour UTC de la mesure (AAAA-MM-JJ), calcule par le serveur. */
  jourUtc: string;
  poidsKg: number;
  /** Bornes du plan actif, en jour UTC (AAAA-MM-JJ). */
  planDateDebutJourUtc: string;
  planDateCibleJourUtc: string;
  /**
   * Poids de la derniere mesure VALIDE de la veille pour le MEME plan, ou
   * null si aucune (dans ce cas le controle suspect est ignore).
   */
  poidsValideVeille: number | null;
}

/**
 * Classe une mesure automatique (FR403-672).
 * Priorite : hors-plan d'abord (hors periode du plan), puis suspecte
 * (ecart > seuil avec la veille du meme plan), sinon valide.
 * Les chaines AAAA-MM-JJ se comparent directement dans l'ordre lexicographique.
 */
export function classifyMeasurement(
  input: ClassificationInput,
): MeasurementStatut {
  if (
    input.jourUtc < input.planDateDebutJourUtc ||
    input.jourUtc > input.planDateCibleJourUtc
  ) {
    return 'hors-plan';
  }
  if (
    input.poidsValideVeille !== null &&
    Math.abs(input.poidsKg - input.poidsValideVeille) > SEUIL_SUSPECT_KG
  ) {
    return 'suspecte';
  }
  return 'valide';
}
