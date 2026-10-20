import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SuivisModule } from '../suivis/suivis.module';
import { GetActivityUseCase } from './application/use-cases/get-activity.use-case';
import { RecordStepsUseCase } from './application/use-cases/record-steps.use-case';
import { ActivityController } from './infrastructure/http/activity.controller';

@Module({
  imports: [AuthModule, SuivisModule],
  controllers: [ActivityController],
  providers: [RecordStepsUseCase, GetActivityUseCase],
  exports: [GetActivityUseCase],
})
export class ActivityModule {}
