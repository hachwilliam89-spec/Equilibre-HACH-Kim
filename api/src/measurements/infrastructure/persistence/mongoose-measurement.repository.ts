import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppException } from '../../../common/errors/app-exception';
import { Measurement } from '../../domain/entities/measurement.entity';
import type { MeasurementRepositoryPort } from '../../domain/ports/measurement-repository.port';
import {
  MeasurementDocument,
  MeasurementDocumentClass,
} from './measurement.schema';

@Injectable()
export class MongooseMeasurementRepository
  implements MeasurementRepositoryPort, OnModuleInit
{
  constructor(
    @InjectModel(MeasurementDocumentClass.name)
    private readonly model: Model<MeasurementDocumentClass>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.model.init();
  }

  async create(measurement: Measurement): Promise<Measurement> {
    const { id, ...props } = measurement.toProps();
    try {
      return this.toDomain(await this.model.create({ _id: id, ...props }));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        // Filet anti-course du blocage FR403-674 : deux insertions valides
        // simultanées pour le même jour ne peuvent pas passer le pré-contrôle
        // du use case ; l'index unique partiel tranche et renvoie le même
        // conflit de jour. Le conflit d'identifiant reste distingué.
        const keyPattern = (error as { keyPattern?: Record<string, unknown> })
          .keyPattern;
        if (keyPattern && 'jourUtc' in keyPattern) {
          throw new AppException(
            'measurement-day-conflict',
            'Une mesure valide existe déjà pour ce jour, tout nouvel enregistrement est refusé',
            HttpStatus.CONFLICT,
          );
        }
        throw new AppException(
          'measurement-conflict',
          'Une mesure existe déjà pour cet identifiant',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async findHistoryByUserId(userId: string): Promise<Measurement[]> {
    const documents = await this.model
      .find({ userId })
      .sort({ receivedAt: -1, _id: -1 })
      .exec();
    return documents.map((document) => this.toDomain(document));
  }

  async findValidForDay(
    userId: string,
    jourUtc: string,
  ): Promise<Measurement | null> {
    const document = await this.model
      .findOne({ userId, jourUtc, statut: 'valide' })
      .exec();
    return document ? this.toDomain(document) : null;
  }

  private toDomain(document: MeasurementDocument): Measurement {
    return Measurement.restore({
      id: document._id,
      userId: document.userId,
      planId: document.planId,
      poidsKg: document.poidsKg,
      receivedAt: document.receivedAt,
      jourUtc: document.jourUtc,
      source: document.source,
      statut: document.statut,
    });
  }
}
