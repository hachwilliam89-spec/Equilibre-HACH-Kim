import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PLAN_REPOSITORY } from '../../domain/ports/plan-repository.port';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import { Plan } from '../../domain/entities/plan.entity';
import { USER_REPOSITORY } from '../../../auth/domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';
import { AppException } from '../../../common/errors/app-exception';

export interface CancelPlanInput {
  coachId: string;
  planId: string;
}

@Injectable()
export class CancelPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(input: CancelPlanInput): Promise<Plan> {
    const plan = await this.planRepository.findById(input.planId);
    if (!plan) {
      throw new AppException(
        'plan-not-found',
        'Plan introuvable',
        HttpStatus.NOT_FOUND,
      );
    }

    // Regle d'acces : un coach ne peut agir que sur les plans de ses
    // utilisateurs rattaches (verifie via le user, la seule source de
    // verite pour le rattachement coach <-> utilisateur).
    const user = await this.userRepository.findById(plan.userId);
    if (!user || user.coachId !== input.coachId) {
      throw new AppException(
        'forbidden',
        'Ce plan ne vous est pas rattache',
        HttpStatus.FORBIDDEN,
      );
    }

    if (plan.statut !== 'actif') {
      throw new AppException(
        'plan-not-active',
        'Seul un plan actif peut etre annule',
        HttpStatus.CONFLICT,
      );
    }

    plan.cancel();
    return this.planRepository.save(plan);
  }
}
