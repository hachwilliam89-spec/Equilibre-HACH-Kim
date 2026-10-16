import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import type { DailyFoodJournal } from '../../domain/entities/daily-food-journal.entity';

/**
 * Journal alimentaire d'un jour UTC passé ou du jour même, en lecture seule
 * (consultation de l'historique conservé, 3 mois). null si aucun journal ce
 * jour-là. Le plan actif est préféré si plusieurs plans ont un journal le
 * même jour (plan annulé puis recréé dans la journée).
 */
@Injectable()
export class GetFoodJournalForDayUseCase {
  constructor(
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(
    userId: string,
    jourUtc: string,
    maintenant = new Date(),
  ): Promise<DailyFoodJournal | null> {
    if (jourUtc > maintenant.toISOString().slice(0, 10)) {
      throw new AppException(
        'future-day',
        'Une journée future ne peut pas être consultée',
        HttpStatus.BAD_REQUEST,
      );
    }
    const suivi = await this.suivis.charger(userId);
    if (!suivi) return null;
    const props = suivi.toProps();
    const journaux = props.journauxAlimentaires.filter(
      (journal) => journal.toProps().jourUtc === jourUtc,
    );
    return (
      journaux.find(
        (journal) => journal.toProps().planId === props.planActif?.id,
      ) ??
      journaux.at(-1) ??
      null
    );
  }
}
