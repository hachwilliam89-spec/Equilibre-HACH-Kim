import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FoodDocument, FoodDocumentClass } from './food.schema';
import { REFERENCE_FOODS } from './reference-foods';

@Injectable()
export class ReferenceFoodsSeed implements OnApplicationBootstrap {
  constructor(
    @InjectModel(FoodDocumentClass.name)
    private readonly foodModel: Model<FoodDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.foodModel.bulkWrite(
      REFERENCE_FOODS.map((food) => ({
        updateOne: {
          filter: { _id: food.id },
          update: {
            $set: {
              nom: food.nom,
              nomNormalise: food.nomNormalise,
              caloriesKcalPour100g: food.caloriesKcalPour100g,
              proteinesGPour100g: food.proteinesGPour100g,
              glucidesGPour100g: food.glucidesGPour100g,
              lipidesGPour100g: food.lipidesGPour100g,
            },
            $setOnInsert: { createdAt: new Date() },
            $currentDate: { updatedAt: true },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
}
