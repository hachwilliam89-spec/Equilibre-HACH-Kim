import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { SearchFoodsUseCase } from './application/use-cases/search-foods.use-case';
import { ManageFavoriteFoodsUseCase } from './application/use-cases/manage-favorite-foods.use-case';
import { FAVORITE_FOODS_REPOSITORY } from './domain/ports/favorite-foods-repository.port';
import { MongooseFavoriteFoodsRepository } from './infrastructure/persistence/mongoose-favorite-foods.repository';
import {
  UserDocumentClass,
  UserSchema,
} from '../auth/infrastructure/persistence/user.schema';
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
      { name: UserDocumentClass.name, schema: UserSchema },
    ]),
  ],
  controllers: [FoodsController],
  providers: [
    ReferenceFoodsSeed,
    MongooseFoodRepository,
    MongooseFavoriteFoodsRepository,
    { provide: FOOD_REPOSITORY, useExisting: MongooseFoodRepository },
    {
      provide: FAVORITE_FOODS_REPOSITORY,
      useExisting: MongooseFavoriteFoodsRepository,
    },
    SearchFoodsUseCase,
    ManageFavoriteFoodsUseCase,
  ],
  exports: [FOOD_REPOSITORY, ManageFavoriteFoodsUseCase],
})
export class FoodsModule {}
