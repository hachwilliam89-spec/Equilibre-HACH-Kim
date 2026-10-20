import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../auth/domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';
import { AppException } from '../../../common/errors/app-exception';
import { Plan } from '../../domain/entities/plan.entity';
import { PLAN_REPOSITORY } from '../../domain/ports/plan-repository.port';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import {
  calculateBmr,
  calculateCalorieBudget,
  calculateWeeklyRateKgPerWeek,
} from '../../domain/services/metabolic-calculations';

export interface UpdatePlanInput {
  coachId: string;
  planId: string;
  poidsCible?: number;
  dateCible?: Date;
  /** Saisi par le coach : prévaut sur le recalcul automatique. */
  budgetCalorique?: number;
}

/**
 * Ajustement du plan actif par son coach (US5, FR403-970). Les règles de la
 * création sont revérifiées sur le plan modifié ; sans budget saisi, il est
 * recalculé quand l'objectif change.
 */
@Injectable()
export class UpdatePlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(
    input: UpdatePlanInput,
    maintenant: Date = new Date(),
  ): Promise<Plan> {
    const plan = await this.planRepository.findById(input.planId);
    if (!plan) {
      throw new AppException(
        'plan-not-found',
        'Plan introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
    const user = await this.userRepository.findById(plan.userId);
    if (!user || user.coachId !== input.coachId) {
      throw new AppException(
        'forbidden',
        'Ce plan ne vous est pas rattache',
        HttpStatus.FORBIDDEN,
      );
    }
    if (plan.statut === 'actif' && plan.hasExpired(maintenant)) {
      // Résout l'expiration au passage, comme l'annulation.
      await this.planRepository.findActiveByUserId(plan.userId);
    }
    if (plan.statut !== 'actif' || plan.hasExpired(maintenant)) {
      throw new AppException(
        'plan-not-active',
        'Seul un plan actif peut etre ajuste',
        HttpStatus.CONFLICT,
      );
    }
    if (!user.tailleCm) {
      throw new AppException(
        'missing-taille',
        'Taille non renseignee sur le profil utilisateur : completez-la avant d’ajuster le plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    const props = plan.toProps();
    const poidsCible = input.poidsCible ?? props.poidsCible;
    const dateCible = input.dateCible ?? props.dateCible;
    if (
      input.dateCible &&
      input.dateCible.toISOString().slice(0, 10) <
        maintenant.toISOString().slice(0, 10)
    ) {
      throw new AppException(
        'invalid-plan',
        'La date cible ne peut pas etre deja passee',
        HttpStatus.BAD_REQUEST,
      );
    }
    const objectifModifie =
      poidsCible !== props.poidsCible ||
      dateCible.getTime() !== props.dateCible.getTime();

    let budgetCalorique = props.budgetCalorique;
    let budgetPlafonneAuBmr = props.budgetPlafonneAuBmr;
    if (input.budgetCalorique !== undefined) {
      budgetCalorique = input.budgetCalorique;
      budgetPlafonneAuBmr = false;
    } else if (objectifModifie) {
      if (!user.age || !user.sexe) {
        throw new AppException(
          'incomplete-metabolic-profile',
          'Profil incomplet (age/sexe manquants) : saisissez le budget calorique ajuste',
          HttpStatus.BAD_REQUEST,
        );
      }
      const budget = calculateCalorieBudget({
        bmr: calculateBmr({
          sexe: user.sexe,
          poidsKg: props.poidsDepart,
          tailleCm: user.tailleCm,
          age: user.age,
        }),
        niveauActivite: props.niveauActivite,
        rythmeKgParSemaine: calculateWeeklyRateKgPerWeek(
          props.poidsDepart,
          poidsCible,
          props.dateDebut,
          dateCible,
        ),
      });
      budgetCalorique = budget.budget;
      budgetPlafonneAuBmr = budget.budgetPlafonneAuBmr;
    }

    try {
      plan.ajuster(
        {
          poidsCible,
          dateCible,
          budgetCalorique,
          budgetPlafonneAuBmr,
          tailleCm: user.tailleCm,
        },
        maintenant,
      );
    } catch (error) {
      throw new AppException(
        'invalid-plan',
        error instanceof Error ? error.message : 'Plan invalide',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.planRepository.updateActive(plan);
  }
}
