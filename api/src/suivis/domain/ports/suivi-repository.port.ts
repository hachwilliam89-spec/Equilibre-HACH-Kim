import { Suivi } from '../entities/suivi.entity';
import { Measurement } from '../../../measurements/domain/entities/measurement.entity';

export interface SuiviRepositoryPort {
  charger(userId: string): Promise<Suivi | null>;
  chercherParPlanId(planId: string): Promise<Suivi | null>;
  lireHistorique(userId: string): Promise<Measurement[]>;
  lireMesureValideDuJour(
    userId: string,
    jourUtc: string,
    planId?: string,
  ): Promise<Measurement | null>;
  lireDerniereMesureValide(userId: string): Promise<Measurement | null>;
  creer(suivi: Suivi): Promise<boolean>;
  sauvegarderSiVersion(suivi: Suivi, versionAttendue: number): Promise<boolean>;
}

export const SUIVI_REPOSITORY = Symbol('SUIVI_REPOSITORY');
