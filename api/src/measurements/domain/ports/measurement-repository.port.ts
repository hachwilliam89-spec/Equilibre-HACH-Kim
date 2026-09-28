import { Measurement } from '../entities/measurement.entity';

export interface MeasurementRepositoryPort {
  /** Ajout uniquement : une correction ne remplace pas une mesure historique. */
  create(measurement: Measurement): Promise<Measurement>;
  /** Tous plans, sources et statuts ; réception décroissante. */
  findHistoryByUserId(userId: string): Promise<Measurement[]>;
}

export const MEASUREMENT_REPOSITORY = Symbol('MEASUREMENT_REPOSITORY');
