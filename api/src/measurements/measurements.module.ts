import { PlansModule } from '../plans/plans.module';
import { ReceiveMeasurementUseCase } from './application/use-cases/receive-measurement.use-case';
import { Module } from '@nestjs/common';
import { SuivisModule } from '../suivis/suivis.module';
import { AuthModule } from '../auth/auth.module';
import { GetMeasurementHistoryUseCase } from './application/use-cases/get-measurement-history.use-case';
import { GetWeightTrackingStatusUseCase } from './application/use-cases/get-weight-tracking-status.use-case';
import { CorrectMeasurementUseCase } from './application/use-cases/correct-measurement.use-case';
import { MEASUREMENT_REPOSITORY } from './domain/ports/measurement-repository.port';
import { MeasurementsController } from './infrastructure/http/measurements.controller';
import { MongooseMeasurementRepository } from './infrastructure/persistence/mongoose-measurement.repository';

@Module({
  imports: [AuthModule, PlansModule, SuivisModule],
  controllers: [MeasurementsController],
  providers: [
    GetMeasurementHistoryUseCase,
    GetWeightTrackingStatusUseCase,
    ReceiveMeasurementUseCase,
    CorrectMeasurementUseCase,
    {
      provide: MEASUREMENT_REPOSITORY,
      useClass: MongooseMeasurementRepository,
    },
  ],
  exports: [
    MEASUREMENT_REPOSITORY,
    GetMeasurementHistoryUseCase,
    GetWeightTrackingStatusUseCase,
    CorrectMeasurementUseCase,
  ],
})
export class MeasurementsModule {}
