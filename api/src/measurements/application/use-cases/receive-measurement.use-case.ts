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
import { classifyMeasurement } from '../../domain/services/measurement-classification';

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

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
    const planProps = plan.toProps();
    const jourUtc = receivedAt.toISOString().slice(0, 10);
    const jourVeille = new Date(receivedAt.getTime() - UN_JOUR_MS)
      .toISOString()
      .slice(0, 10);

    // FR403-672 : classification suspecte / hors-plan. La reference de la
    // veille doit appartenir au meme plan actif.
    const veille = await this.measurements.findValidForDay(
      userId,
      jourVeille,
      plan.id,
    );
    const statut = classifyMeasurement({
      jourUtc,
      poidsKg,
      planDateDebutJourUtc: planProps.dateDebut.toISOString().slice(0, 10),
      planDateCibleJourUtc: planProps.dateCible.toISOString().slice(0, 10),
      poidsValideVeille: veille ? veille.toProps().poidsKg : null,
    });

    const measurement = Measurement.create({
      id: randomUUID(),
      userId,
      planId: plan.id,
      poidsKg,
      receivedAt,
      source: 'automatique',
      statut,
    });

    // Précontrôle rapide ; l'agrégat Suivi reste l'autorité en cas de course.
    if (statut === 'valide') {
      const dejaValide = await this.measurements.findValidForDay(
        userId,
        jourUtc,
      );
      if (dejaValide) {
        throw this.dayConflict();
      }
    }
    return this.measurements.create(measurement);
  }

  private dayConflict(): AppException {
    return new AppException(
      'measurement-day-conflict',
      'Mesure déjà enregistrée aujourd’hui',
      HttpStatus.CONFLICT,
    );
  }
}
