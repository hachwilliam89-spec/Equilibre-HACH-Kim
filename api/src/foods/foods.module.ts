import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { SearchFoodsUseCase } from './application/use-cases/search-foods.use-case';
import { FOOD_REPOSITORY } from './domain/ports/food-repository.port';
import { FoodsController } from './infrastructure/http/foods.controller';
import {
  FoodDocumentClass,
  FoodSchema,
} from './infrastructure/persistence/food.schema';
import { ReferenceFoodsSeed } from './infrastructure/persistence/reference-foods.seed';
import { MongooseFoodRepository } from './infrastructure/persistence/mongoose-food.repository';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: FoodDocumentClass.name, schema: FoodSchema },
    ]),
  ],
  controllers: [FoodsController],
  providers: [
    ReferenceFoodsSeed,
    MongooseFoodRepository,
    { provide: FOOD_REPOSITORY, useExisting: MongooseFoodRepository },
    SearchFoodsUseCase,
  ],
  exports: [FOOD_REPOSITORY],
})
export class FoodsModule {}
