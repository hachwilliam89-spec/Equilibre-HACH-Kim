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
import { verifierSaisieDiffereePoids } from '../../domain/services/saisie-differee-poids';

/** Saisie manuelle effectuée hors ligne, rejouée par la synchronisation. */
export interface SaisiePoidsDifferee {
  /** Identifiant généré par l'appareil : rend le rejeu idempotent. */
  mesureId: string;
  poidsKg: number;
  saisiLe: Date;
}

@Injectable()
export class CorrectMeasurementUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(MEASUREMENT_REPOSITORY)
    private readonly measurements: MeasurementRepositoryPort,
  ) {}

  async execute(userId: string, poidsKg: number): Promise<Measurement> {
    return this.corriger(userId, poidsKg, randomUUID());
  }

  async executeDepuisSynchro(
    userId: string,
    saisie: SaisiePoidsDifferee,
  ): Promise<{ mesure: Measurement; dejaAppliquee: boolean }> {
    const refus = verifierSaisieDiffereePoids(saisie.saisiLe, new Date());
    if (refus) {
      throw new AppException(
        refus,
        refus === 'saisie-poids-expiree'
          ? 'Saisie de poids hors ligne non synchronisée le jour même'
          : "Horodatage de l'appareil incohérent",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const existante = (
      await this.measurements.findHistoryByUserId(userId)
    ).find((measurement) => measurement.toProps().id === saisie.mesureId);
    if (existante) return { mesure: existante, dejaAppliquee: true };
    return {
      mesure: await this.corriger(userId, saisie.poidsKg, saisie.mesureId),
      dejaAppliquee: false,
    };
  }

  private async corriger(
    userId: string,
    poidsKg: number,
    id: string,
  ): Promise<Measurement> {
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
      id,
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
