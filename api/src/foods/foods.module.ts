import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FoodDocumentClass,
  FoodSchema,
} from './infrastructure/persistence/food.schema';
import { ReferenceFoodsSeed } from './infrastructure/persistence/reference-foods.seed';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FoodDocumentClass.name, schema: FoodSchema },
    ]),
  ],
  providers: [ReferenceFoodsSeed],
  exports: [MongooseModule],
})
export class FoodsModule {}
