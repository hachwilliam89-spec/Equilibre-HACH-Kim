import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import { Suivi } from '../../../suivis/domain/entities/suivi.entity';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import { Plan } from '../../domain/entities/plan.entity';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';

const MAX_TENTATIVES = 5;

@Injectable()
export class MongoosePlanRepository implements PlanRepositoryPort {
  constructor(
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async create(plan: Plan): Promise<Plan> {
    for (let attempt = 0; attempt < MAX_TENTATIVES; attempt += 1) {
      const existing = await this.suivis.charger(plan.userId);
      const suivi = existing ?? Suivi.create(plan.userId);
      suivi.activerPlan(plan);
      const saved = existing
        ? await this.suivis.sauvegarderSiVersion(
            suivi,
            existing.toProps().version,
          )
        : await this.suivis.creer(suivi);
      if (saved) return plan;
    }
    throw this.planConflict();
  }

  async findById(id: string): Promise<Plan | null> {
    const suivi = await this.suivis.chercherParPlanId(id);
    if (!suivi) return null;
    const props = suivi.toProps();
    return (
      (props.planActif?.id === id ? props.planActif : null) ??
      props.plans.find((plan) => plan.id === id) ??
      null
    );
  }

  async findActiveByUserId(userId: string): Promise<Plan | null> {
    for (let attempt = 0; attempt < MAX_TENTATIVES; attempt += 1) {
      const suivi = await this.suivis.charger(userId);
      if (!suivi) return null;
      const plan = suivi.toProps().planActif;
      if (!plan) return null;
      if (!plan.hasExpired(new Date())) return plan;
      const version = suivi.toProps().version;
      plan.terminate();
      suivi.terminerPlan(plan);
      if (await this.suivis.sauvegarderSiVersion(suivi, version)) return null;
    }
    throw this.planConflict();
  }

  async save(plan: Plan): Promise<Plan> {
    for (let attempt = 0; attempt < MAX_TENTATIVES; attempt += 1) {
      const suivi = await this.suivis.chercherParPlanId(plan.id);
      if (!suivi) {
        throw new AppException(
          'plan-not-found',
          'Plan introuvable',
          HttpStatus.NOT_FOUND,
        );
      }
      const version = suivi.toProps().version;
      suivi.terminerPlan(plan);
      if (await this.suivis.sauvegarderSiVersion(suivi, version)) return plan;
    }
    throw this.planConflict();
  }

  private planConflict(): AppException {
    return new AppException(
      'plan-already-active',
      'Un plan actif existe deja pour cet utilisateur',
      HttpStatus.CONFLICT,
    );
  }
}
