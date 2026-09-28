import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import {
  PLAN_REPOSITORY,
  type PlanRepositoryPort,
} from '../../../plans/domain/ports/plan-repository.port';
import { Measurement } from '../../domain/entities/measurement.entity';
import {
  MEASUREMENT_REPOSITORY,
  type MeasurementRepositoryPort,
} from '../../domain/ports/measurement-repository.port';

@Injectable()
export class ReceiveMeasurementUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(MEASUREMENT_REPOSITORY)
    private readonly measurements: MeasurementRepositoryPort,
  ) {}

  async execute(userId: string, poidsKg: number): Promise<Measurement> {
    const receivedAt = new Date();
    const plan = await this.plans.findActiveByUserId(userId);
    if (!plan) {
      throw new AppException(
        'no-active-plan',
        'Aucun plan actif pour enregistrer une mesure',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const measurement = Measurement.create({
      id: randomUUID(),
      userId,
      planId: plan.id,
      poidsKg,
      receivedAt,
      source: 'automatique',
      // FR403-672 ajoutera la classification suspecte / hors-plan.
      statut: 'valide',
    });
    // FR403-674 : une seule mesure valide par jour UTC, toutes sources
    // confondues. Pré-contrôle explicite dans le domaine applicatif ;
    // l'index unique de la persistance reste le filet en cas de course.
    const jourUtc = measurement.toProps().jourUtc;
    const dejaValide = await this.measurements.findValidForDay(userId, jourUtc);
    if (dejaValide) {
      throw this.dayConflict();
    }
    return this.measurements.create(measurement);
  }

  private dayConflict(): AppException {
    return new AppException(
      'measurement-day-conflict',
      'Une mesure valide existe déjà pour ce jour, tout nouvel enregistrement est refusé',
      HttpStatus.CONFLICT,
    );
  }
}
