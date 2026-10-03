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
      const journal = suivi?.trouverJournalParEntreeAlimentaire(entryId);
      if (!suivi || !journal) {
        throw new AppException(
          'food-entry-not-found',
          'Entrée alimentaire introuvable',
          HttpStatus.NOT_FOUND,
        );
      }
      const version = suivi.toProps().version;
      journal.retirerEntree(entryId);
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
