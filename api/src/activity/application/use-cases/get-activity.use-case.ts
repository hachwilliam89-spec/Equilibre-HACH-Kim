import { Inject, Injectable } from '@nestjs/common';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import {
  moyenneSeptJours,
  type MoyenneActivite,
  type PasQuotidien,
} from '../../domain/services/niveau-activite';

export interface Activite {
  /** Historique conservé (3 mois), du plus récent au plus ancien. */
  historique: PasQuotidien[];
  moyenne7Jours: MoyenneActivite;
}

/** Historique des pas et niveau déduit, à titre informatif (US4). */
@Injectable()
export class GetActivityUseCase {
  constructor(
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(
    userId: string,
    maintenant: Date = new Date(),
  ): Promise<Activite> {
    const suivi = await this.suivis.charger(userId);
    const pas = suivi?.toProps().pasQuotidiens ?? [];
    return {
      historique: [...pas].sort((a, b) => b.jourUtc.localeCompare(a.jourUtc)),
      moyenne7Jours: moyenneSeptJours(
        pas,
        maintenant.toISOString().slice(0, 10),
      ),
    };
  }
}
