import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PLAN_REPOSITORY } from '../../domain/ports/plan-repository.port';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import { Plan } from '../../domain/entities/plan.entity';
import { USER_REPOSITORY } from '../../../auth/domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';
import type { Role } from '../../../auth/domain/entities/user.entity';
import { AppException } from '../../../common/errors/app-exception';

export interface GetCurrentPlanInput {
  requesterId: string;
  requesterRole: Role;
  targetUserId: string;
}

@Injectable()
export class GetCurrentPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(input: GetCurrentPlanInput): Promise<Plan | null> {
    if (input.requesterRole === 'utilisateur') {
      // Regle d'acces : un utilisateur ne voit que son propre plan.
      if (input.requesterId !== input.targetUserId) {
        throw new AppException(
          'forbidden',
          'Un utilisateur ne peut consulter que son propre plan',
          HttpStatus.FORBIDDEN,
        );
      }
    } else {
      // Regle d'acces : un coach ne voit que les utilisateurs qui lui sont rattaches.
      const target = await this.userRepository.findById(input.targetUserId);
      if (!target || target.coachId !== input.requesterId) {
        throw new AppException(
          'forbidden',
          'Cet utilisateur ne vous est pas rattache',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return this.planRepository.findActiveByUserId(input.targetUserId);
  }
}
