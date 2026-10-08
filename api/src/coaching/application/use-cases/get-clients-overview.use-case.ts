import { Inject, Injectable } from '@nestjs/common';
import type { User } from '../../../auth/domain/entities/user.entity';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../../auth/domain/ports/user-repository.port';
import {
  GetWeightTrackingStatusUseCase,
  type WeightTrackingStatus,
} from '../../../measurements/application/use-cases/get-weight-tracking-status.use-case';
import { GetFoodBudgetStatusUseCase } from '../../../nutrition/application/use-cases/get-food-budget-status.use-case';
import type { FoodBudgetResult } from '../../../nutrition/domain/services/food-budget-status';

export interface ClientOverview {
  utilisateur: User;
  suiviPoids: WeightTrackingStatus | null;
  alimentation: FoodBudgetResult | null;
}

/** Vue d'ensemble : statuts poids et alimentation de chaque utilisateur rattaché. */
@Injectable()
export class GetClientsOverviewUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly weightStatus: GetWeightTrackingStatusUseCase,
    private readonly foodStatus: GetFoodBudgetStatusUseCase,
  ) {}

  async execute(coachId: string): Promise<ClientOverview[]> {
    const clients = await this.users.findByCoachId(coachId);
    return Promise.all(
      clients.map(async (utilisateur) => {
        const [suiviPoids, alimentation] = await Promise.all([
          this.weightStatus.execute(utilisateur.id),
          this.foodStatus.execute(utilisateur.id),
        ]);
        return {
          utilisateur,
          suiviPoids,
          alimentation: alimentation
            ? { statut: alimentation.statut, ecartKcal: alimentation.ecartKcal }
            : null,
        };
      }),
    );
  }
}
