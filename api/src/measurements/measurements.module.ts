import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { GetMeasurementHistoryUseCase } from './application/use-cases/get-measurement-history.use-case';
import { MEASUREMENT_REPOSITORY } from './domain/ports/measurement-repository.port';
import { MeasurementsController } from './infrastructure/http/measurements.controller';
import {
  MeasurementDocumentClass,
  MeasurementSchema,
} from './infrastructure/persistence/measurement.schema';
import { MongooseMeasurementRepository } from './infrastructure/persistence/mongoose-measurement.repository';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: MeasurementDocumentClass.name, schema: MeasurementSchema },
    ]),
  ],
  controllers: [MeasurementsController],
  providers: [
    GetMeasurementHistoryUseCase,
    {
      provide: MEASUREMENT_REPOSITORY,
      useClass: MongooseMeasurementRepository,
    },
  ],
  exports: [MEASUREMENT_REPOSITORY],
})
export class MeasurementsModule {}
