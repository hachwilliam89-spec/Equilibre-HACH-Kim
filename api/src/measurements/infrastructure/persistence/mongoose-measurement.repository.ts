import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import { Measurement } from '../../domain/entities/measurement.entity';
import type { MeasurementRepositoryPort } from '../../domain/ports/measurement-repository.port';

const MAX_TENTATIVES = 5;

@Injectable()
export class MongooseMeasurementRepository implements MeasurementRepositoryPort {
  constructor(
    @Inject(SUIVI_REPOSITORY) private readonly suivis: SuiviRepositoryPort,
  ) {}

  async create(measurement: Measurement): Promise<Measurement> {
    const { userId } = measurement.toProps();
    for (let attempt = 0; attempt < MAX_TENTATIVES; attempt += 1) {
      const suivi = await this.suivis.charger(userId);
      if (!suivi) {
        throw new AppException(
          'no-active-plan',
          'Aucun plan actif pour enregistrer une mesure',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const version = suivi.toProps().version;
      suivi.ajouterMesure(measurement);
      if (await this.suivis.sauvegarderSiVersion(suivi, version)) {
        return measurement;
      }
    }
    throw new AppException(
      'measurement-concurrent-update',
      'Le suivi a été modifié simultanément, veuillez réessayer',
      HttpStatus.CONFLICT,
    );
  }

  async findHistoryByUserId(userId: string): Promise<Measurement[]> {
    const mesures = await this.suivis.lireHistorique(userId);
    return mesures.sort((a, b) => {
      const aProps = a.toProps();
      const bProps = b.toProps();
      return (
        bProps.receivedAt.getTime() - aProps.receivedAt.getTime() ||
        bProps.id.localeCompare(aProps.id)
      );
    });
  }

  async findValidForDay(
    userId: string,
    jourUtc: string,
    planId?: string,
  ): Promise<Measurement | null> {
    return this.suivis.lireMesureValideDuJour(userId, jourUtc, planId);
  }

  async findLatestValidForPlan(
    userId: string,
    planId: string,
  ): Promise<Measurement | null> {
    const latest = await this.suivis.lireDerniereMesureValide(userId);
    return latest?.toProps().planId === planId ? latest : null;
  }
}
