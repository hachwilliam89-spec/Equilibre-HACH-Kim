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
        throw new AppException(
          'measurement-conflict',
          'Une mesure existe déjà pour cet identifiant ou une valeur valide pour ce jour',
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
