import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeasurementsModule } from '../measurements/measurements.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { SuivisModule } from '../suivis/suivis.module';
import { GetClientProgressionUseCase } from './application/use-cases/get-client-progression.use-case';
import { GetClientsOverviewUseCase } from './application/use-cases/get-clients-overview.use-case';
import { CoachProgressionController } from './infrastructure/http/coach-progression.controller';

/**
 * Lecture de la progression des utilisateurs par leur coach (cahier des
 * charges : « consulter la progression »). Aucune écriture : le module
 * réutilise les cas d'usage de lecture de l'utilisateur.
 */
@Module({
  imports: [AuthModule, MeasurementsModule, NutritionModule, SuivisModule],
  controllers: [CoachProgressionController],
  providers: [GetClientsOverviewUseCase, GetClientProgressionUseCase],
})
export class CoachingModule {}
