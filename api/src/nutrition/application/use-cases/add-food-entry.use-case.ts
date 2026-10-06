import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import {
  FOOD_REPOSITORY,
  type FoodRepositoryPort,
} from '../../../foods/domain/ports/food-repository.port';
import type { Plan } from '../../../plans/domain/entities/plan.entity';
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
import {
  horodatageRetenu,
  verifierSaisieDiffereeAliment,
} from '../../domain/services/saisie-differee';

const MAX_TENTATIVES = 5;

/** Entrée saisie hors ligne et rejouée par la synchronisation. */
export interface EntreeDifferee {
  /** Identifiant généré par l'appareil : rend le rejeu idempotent. */
  entreeId: string;
  foodId: string;
  quantiteGrammes: number;
  categorieRepas?: MealCategory;
  /** Heure de consommation selon l'appareil. */
  consommeLe: Date;
}

export interface ResultatAjout {
  journal: DailyFoodJournal;
  /** true si l'entrée existait déjà (opération déjà rejouée). */
  dejaAppliquee: boolean;
}

@Injectable()
export class AddFoodEntryUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(FOOD_REPOSITORY) private readonly foods: FoodRepositoryPort,
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  /** Ajout en ligne : le serveur horodate l'entrée. */
  async execute(
    userId: string,
    foodId: string,
    quantiteGrammes: number,
    categorieRepas?: MealCategory,
  ): Promise<DailyFoodJournal> {
    const receivedAt = new Date();
    const { journal } = await this.ajouter(userId, {
      entreeId: randomUUID(),
      foodId,
      quantiteGrammes,
      categorieRepas,
      receivedAt,
      maintenant: receivedAt,
    });
    return journal;
  }

  /**
   * Ajout différé (synchronisation) : l'heure de consommation de l'appareil
   * est retenue dans la fenêtre autorisée, et un même entreeId n'est jamais
   * enregistré deux fois.
   */
  async executeDepuisSynchro(
    userId: string,
    entree: EntreeDifferee,
  ): Promise<ResultatAjout> {
    const maintenant = new Date();
    const plan = await this.plans.findActiveByUserId(userId);
    if (!plan) throw this.noActivePlan();
    const planProps = plan.toProps();
    const refus = verifierSaisieDiffereeAliment(
      entree.consommeLe,
      maintenant,
      planProps,
    );
    if (refus) {
      throw new AppException(
        refus,
        refus === 'saisie-trop-ancienne'
          ? 'Entrée trop ancienne pour être synchronisée'
          : refus === 'saisie-hors-plan'
            ? 'Entrée en dehors de la période du plan'
            : "Horodatage de l'appareil incohérent",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.ajouter(
      userId,
      {
        entreeId: entree.entreeId,
        foodId: entree.foodId,
        quantiteGrammes: entree.quantiteGrammes,
        categorieRepas: entree.categorieRepas,
        receivedAt: horodatageRetenu(entree.consommeLe, maintenant),
        maintenant,
      },
      plan,
    );
  }

  private async ajouter(
    userId: string,
    input: {
      entreeId: string;
      foodId: string;
      quantiteGrammes: number;
      categorieRepas?: MealCategory;
      receivedAt: Date;
      maintenant: Date;
    },
    planConnu?: Plan,
  ): Promise<ResultatAjout> {
    const plan = planConnu ?? (await this.plans.findActiveByUserId(userId));
    if (!plan) throw this.noActivePlan();

    const food = await this.foods.findById(input.foodId);
    if (!food) {
      throw new AppException(
        'food-not-found',
        'Aliment de référence introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
    const entry = FoodEntry.create({
      id: input.entreeId,
      aliment: food.toProps(),
      quantiteGrammes: input.quantiteGrammes,
      receivedAt: input.receivedAt,
      categorieRepas: input.categorieRepas,
    });
    const jourUtc = input.receivedAt.toISOString().slice(0, 10);

    for (let attempt = 0; attempt < MAX_TENTATIVES; attempt += 1) {
      const suivi = await this.suivis.charger(userId);
      if (
        !suivi ||
        suivi.toProps().planActif?.id !== plan.id ||
        plan.hasExpired(input.maintenant)
      ) {
        throw this.noActivePlan();
      }
      const existant = suivi.trouverJournalParEntreeAlimentaire(input.entreeId);
      if (existant) return { journal: existant, dejaAppliquee: true };

      const version = suivi.toProps().version;
      let journal = suivi.trouverJournalAlimentaire(plan.id, jourUtc);
      if (!journal) {
        journal = DailyFoodJournal.create(plan, input.receivedAt);
        journal.ajouterEntree(entry);
        suivi.ajouterJournalAlimentaire(journal, input.maintenant);
      } else {
        journal.ajouterEntree(entry);
      }
      if (await this.suivis.sauvegarderSiVersion(suivi, version))
        return { journal, dejaAppliquee: false };
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
