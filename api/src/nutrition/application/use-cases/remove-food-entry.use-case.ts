import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import { DailyFoodJournal } from '../../domain/entities/daily-food-journal.entity';

const MAX_TENTATIVES = 5;

@Injectable()
export class RemoveFoodEntryUseCase {
  constructor(
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(userId: string, entryId: string): Promise<DailyFoodJournal> {
    for (let attempt = 0; attempt < MAX_TENTATIVES; attempt += 1) {
      const suivi = await this.suivis.charger(userId);
      const version = suivi?.toProps().version;
      // Retrait et trace du retrait dans la même écriture (version attendue) :
      // un ajout rejoué plus tard ne recrée pas l'entrée.
      const journal = suivi?.retirerEntreeAlimentaire(entryId, new Date());
      if (!suivi || !journal || version === undefined) {
        throw new AppException(
          'food-entry-not-found',
          'Entrée alimentaire introuvable',
          HttpStatus.NOT_FOUND,
        );
      }
      if (await this.suivis.sauvegarderSiVersion(suivi, version))
        return journal;
    }

    throw new AppException(
      'food-journal-concurrent-update',
      'Le journal a été modifié simultanément, veuillez réessayer',
      HttpStatus.CONFLICT,
    );
  }
}
