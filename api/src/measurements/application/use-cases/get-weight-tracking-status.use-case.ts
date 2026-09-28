import { Inject, Injectable } from '@nestjs/common';
import {
  PLAN_REPOSITORY,
  type PlanRepositoryPort,
} from '../../../plans/domain/ports/plan-repository.port';
import type { Plan } from '../../../plans/domain/entities/plan.entity';
import { Measurement } from '../../domain/entities/measurement.entity';
import {
  MEASUREMENT_REPOSITORY,
  type MeasurementRepositoryPort,
} from '../../domain/ports/measurement-repository.port';
import {
  StatutSuivi,
  determinerSuivi,
} from '../../domain/services/measurement-suivi';
import { EcartTrajectoire } from '../../domain/services/measurement-trajectory';

export interface WeightTrackingStatus {
  statut: StatutSuivi;
  plan: Plan;
  derniereMesure: Measurement | null;
  ecart: EcartTrajectoire | null;
}

@Injectable()
export class GetWeightTrackingStatusUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(MEASUREMENT_REPOSITORY)
    private readonly measurements: MeasurementRepositoryPort,
  ) {}

  async execute(userId: string): Promise<WeightTrackingStatus | null> {
    const plan = await this.plans.findActiveByUserId(userId);
    if (!plan) {
      return null;
    }
    const derniereMesure = await this.measurements.findLatestValidForPlan(
      userId,
      plan.id,
    );
    const planProps = plan.toProps();
    const suivi = determinerSuivi({
      plan: {
        poidsDepart: planProps.poidsDepart,
        poidsCible: planProps.poidsCible,
        dateDebut: planProps.dateDebut,
        dateCible: planProps.dateCible,
      },
      jourCourantUtc: new Date().toISOString().slice(0, 10),
      derniereValide: derniereMesure
        ? {
            jourUtc: derniereMesure.toProps().jourUtc,
            poidsKg: derniereMesure.toProps().poidsKg,
          }
        : null,
    });
    return {
      statut: suivi.statut,
      plan,
      derniereMesure,
      ecart: suivi.ecart,
    };
  }
}
