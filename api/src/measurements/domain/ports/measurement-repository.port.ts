import { Measurement } from '../entities/measurement.entity';

export interface MeasurementRepositoryPort {
  /** Ajout uniquement : une correction ne remplace pas une mesure historique. */
  create(measurement: Measurement): Promise<Measurement>;
  /** Tous plans, sources et statuts ; réception décroissante. */
  findHistoryByUserId(userId: string): Promise<Measurement[]>;
  /**
   * Mesure valide (ni suspecte, ni hors-plan) déjà enregistrée pour ce jour UTC,
   * ou null. Sert au blocage des doublons (FR403-674) : une seule mesure valide
   * par utilisateur et par jour, toutes sources confondues.
   */
  findValidForDay(userId: string, jourUtc: string): Promise<Measurement | null>;
}

export const MEASUREMENT_REPOSITORY = Symbol('MEASUREMENT_REPOSITORY');
