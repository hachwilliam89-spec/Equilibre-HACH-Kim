import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PLAN_REPOSITORY } from '../../domain/ports/plan-repository.port';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import { Plan } from '../../domain/entities/plan.entity';
import { AppException } from '../../../common/errors/app-exception';
import { PreparePlanUseCase } from './prepare-plan.use-case';
import type { PreparePlanInput } from './prepare-plan.use-case';

export type CreatePlanInput = PreparePlanInput;

@Injectable()
export class CreatePlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepositoryPort,
    private readonly preparePlanUseCase: PreparePlanUseCase,
  ) {}

  async execute(input: CreatePlanInput): Promise<Plan> {
    // Recalcule et revalide à la soumission : une proposition ne réserve rien.
    const plan = await this.preparePlanUseCase.execute(input);
    if (await this.planRepository.findActiveByUserId(input.userId)) {
      throw new AppException(
        'plan-already-active',
        'Un plan actif existe deja pour cet utilisateur',
        HttpStatus.CONFLICT,
      );
    }
    return this.planRepository.create(plan);
  }
}
