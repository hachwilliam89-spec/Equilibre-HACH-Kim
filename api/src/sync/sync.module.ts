import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodsModule } from '../foods/foods.module';
import { MeasurementsModule } from '../measurements/measurements.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { SuivisModule } from '../suivis/suivis.module';
import { ApplySyncOperationsUseCase } from './application/use-cases/apply-sync-operations.use-case';
import { GetSyncSnapshotUseCase } from './application/use-cases/get-sync-snapshot.use-case';
import { SyncController } from './infrastructure/http/sync.controller';

/**
 * Synchronisation BDD embarquée (mobile) <-> MongoDB. Module d'orchestration
 * pur : aucune persistance propre, il compose les use cases des modules
 * métier (hexagonal : ajout d'un module sans modifier les règles existantes).
 */
@Module({
  imports: [
    AuthModule,
    FoodsModule,
    MeasurementsModule,
    NutritionModule,
    SuivisModule,
  ],
  controllers: [SyncController],
  providers: [GetSyncSnapshotUseCase, ApplySyncOperationsUseCase],
})
export class SyncModule {}
