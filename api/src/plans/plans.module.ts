import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { PLAN_REPOSITORY } from './domain/ports/plan-repository.port';
import { MongoosePlanRepository } from './infrastructure/persistence/mongoose-plan.repository';
import {
  PlanDocumentClass,
  PlanSchema,
} from './infrastructure/persistence/plan.schema';
import { PlansController } from './infrastructure/http/plans.controller';
import { CreatePlanUseCase } from './application/use-cases/create-plan.use-case';
import { GetCurrentPlanUseCase } from './application/use-cases/get-current-plan.use-case';
import { CancelPlanUseCase } from './application/use-cases/cancel-plan.use-case';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlanDocumentClass.name, schema: PlanSchema },
    ]),
    // Pour USER_REPOSITORY : verification du rattachement coach <-> utilisateur
    // et du profil metabolique (taille/age/sexe), deja exporte par AuthModule.
    AuthModule,
  ],
  controllers: [PlansController],
  providers: [
    { provide: PLAN_REPOSITORY, useClass: MongoosePlanRepository },
    CreatePlanUseCase,
    GetCurrentPlanUseCase,
    CancelPlanUseCase,
  ],
})
export class PlansModule {}
