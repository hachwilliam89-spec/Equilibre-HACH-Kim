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

@Injectable()
export class CorrectMeasurementUseCase {
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
        'Aucun plan actif pour enregistrer une correction',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const planProps = plan.toProps();
    const jourUtc = receivedAt.toISOString().slice(0, 10);

    // FR403-670 : une correction manuelle n'est jamais soumise au controle
    // suspecte (override delibere). On reutilise la classification avec une
    // veille nulle : elle ne renvoie donc que hors-plan (hors periode) ou
    // valide.
    const statut = classifyMeasurement({
      jourUtc,
      poidsKg,
      planDateDebutJourUtc: planProps.dateDebut.toISOString().slice(0, 10),
      planDateCibleJourUtc: planProps.dateCible.toISOString().slice(0, 10),
      poidsValideVeille: null,
    });

    const measurement = Measurement.create({
      id: randomUUID(),
      userId,
      planId: plan.id,
      poidsKg,
      receivedAt,
      source: 'manuelle',
      statut,
    });

    // Précontrôle rapide ; l'agrégat Suivi reste l'autorité en cas de course.
    if (statut === 'valide') {
      const dejaValide = await this.measurements.findValidForDay(
        userId,
        jourUtc,
      );
      if (dejaValide) {
        throw new AppException(
          'measurement-day-conflict',
          'Mesure déjà enregistrée aujourd’hui',
          HttpStatus.CONFLICT,
        );
      }
    }
    return this.measurements.create(measurement);
  }
}
