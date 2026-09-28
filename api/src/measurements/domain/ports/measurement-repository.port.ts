import { Measurement } from '../entities/measurement.entity';

export interface MeasurementRepositoryPort {
  /** Ajout uniquement : une correction ne remplace pas une mesure historique. */
  create(measurement: Measurement): Promise<Measurement>;
  /** Tous plans, sources et statuts ; réception décroissante. */
  findHistoryByUserId(userId: string): Promise<Measurement[]>;
  /**
   * Mesure valide (ni suspecte, ni hors-plan) enregistrée pour ce jour UTC,
   * ou null.
   * - Sans planId : blocage des doublons du jour (FR403-674), une seule mesure
   *   valide par utilisateur et par jour, toutes sources confondues.
   * - Avec planId : reference de la veille pour le meme plan (FR403-672),
   *   servant au controle des mesures suspectes.
   */
  findValidForDay(
    userId: string,
    jourUtc: string,
    planId?: string,
  ): Promise<Measurement | null>;
  /**
   * Derniere mesure valide du plan (par reception decroissante), ou null.
   * Sert au statut de suivi (FR403-675).
   */
  findLatestValidForPlan(
    userId: string,
    planId: string,
  ): Promise<Measurement | null>;
}

export const MEASUREMENT_REPOSITORY = Symbol('MEASUREMENT_REPOSITORY');
