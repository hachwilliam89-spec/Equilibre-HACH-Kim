import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import {
  FOOD_REPOSITORY,
  type FoodRepositoryPort,
} from '../../../foods/domain/ports/food-repository.port';
import {
  PLAN_REPOSITORY,
  type PlanRepositoryPort,
} from '../../../plans/domain/ports/plan-repository.port';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import { DailyFoodJournal } from '../../domain/entities/daily-food-journal.entity';
import {
  FoodEntry,
  type MealCategory,
} from '../../domain/entities/food-entry.entity';

const MAX_TENTATIVES = 5;

@Injectable()
export class AddFoodEntryUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(FOOD_REPOSITORY) private readonly foods: FoodRepositoryPort,
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(
    userId: string,
    foodId: string,
    quantiteGrammes: number,
    categorieRepas?: MealCategory,
  ): Promise<DailyFoodJournal> {
    const receivedAt = new Date();
    const plan = await this.plans.findActiveByUserId(userId);
    if (!plan) throw this.noActivePlan();

    const food = await this.foods.findById(foodId);
    if (!food) {
      throw new AppException(
        'food-not-found',
        'Aliment de référence introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
    const entry = FoodEntry.create({
      id: randomUUID(),
      aliment: food.toProps(),
      quantiteGrammes,
      receivedAt,
      categorieRepas,
    });
    const jourUtc = receivedAt.toISOString().slice(0, 10);

    for (let attempt = 0; attempt < MAX_TENTATIVES; attempt += 1) {
      const suivi = await this.suivis.charger(userId);
      if (
        !suivi ||
        suivi.toProps().planActif?.id !== plan.id ||
        plan.hasExpired(new Date())
      ) {
        throw this.noActivePlan();
      }
      const version = suivi.toProps().version;
      let journal = suivi.trouverJournalAlimentaire(plan.id, jourUtc);
      if (!journal) {
        journal = DailyFoodJournal.create(plan, receivedAt);
        journal.ajouterEntree(entry);
        suivi.ajouterJournalAlimentaire(journal, receivedAt);
      } else {
        journal.ajouterEntree(entry);
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

  private noActivePlan(): AppException {
    return new AppException(
      'no-active-plan',
      'Aucun plan actif pour enregistrer un aliment',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
