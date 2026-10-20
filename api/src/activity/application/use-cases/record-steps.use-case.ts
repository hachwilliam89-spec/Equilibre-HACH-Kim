import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import { Suivi } from '../../../suivis/domain/entities/suivi.entity';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import type { PasQuotidien } from '../../domain/services/niveau-activite';

const MAX_TENTATIVES = 3;

/** Réception du total de pas du jour envoyé par la montre (US4). */
@Injectable()
export class RecordStepsUseCase {
  constructor(
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(
    userId: string,
    nombrePas: number,
    maintenant: Date = new Date(),
  ): Promise<PasQuotidien> {
    for (let tentative = 0; tentative < MAX_TENTATIVES; tentative += 1) {
      const existant = await this.suivis.charger(userId);
      if (!existant) {
        // Premier envoi avant tout plan : le suivi est créé pour l'occasion.
        const suivi = Suivi.create(userId);
        const jour = suivi.enregistrerPas(nombrePas, maintenant);
        if (await this.suivis.creer(suivi)) return jour;
        continue;
      }
      const version = existant.toProps().version;
      const jour = existant.enregistrerPas(nombrePas, maintenant);
      if (await this.suivis.sauvegarderSiVersion(existant, version)) {
        return jour;
      }
    }
    throw new AppException(
      'steps-concurrent-update',
      'Le suivi a été modifié simultanément, veuillez réessayer',
      HttpStatus.CONFLICT,
    );
  }
}
