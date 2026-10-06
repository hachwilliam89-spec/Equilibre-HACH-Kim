import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodsModule } from '../foods/foods.module';
import { PlansModule } from '../plans/plans.module';
import { SuivisModule } from '../suivis/suivis.module';
import { AddFoodEntryUseCase } from './application/use-cases/add-food-entry.use-case';
import { RemoveFoodEntryUseCase } from './application/use-cases/remove-food-entry.use-case';
import { GetFoodBudgetStatusUseCase } from './application/use-cases/get-food-budget-status.use-case';
import { FoodJournalsController } from './infrastructure/http/food-journals.controller';

@Module({
  imports: [AuthModule, FoodsModule, PlansModule, SuivisModule],
  controllers: [FoodJournalsController],
  providers: [
    AddFoodEntryUseCase,
    RemoveFoodEntryUseCase,
    GetFoodBudgetStatusUseCase,
  ],
  exports: [
    AddFoodEntryUseCase,
    RemoveFoodEntryUseCase,
    GetFoodBudgetStatusUseCase,
  ],
})
export class NutritionModule {}
