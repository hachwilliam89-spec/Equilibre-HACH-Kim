import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Food, type FoodCategory } from '../../domain/entities/food.entity';
import type { FoodRepositoryPort } from '../../domain/ports/food-repository.port';
import { FoodDocumentClass } from './food.schema';

const FOOD_PROJECTION = {
  _id: 1,
  nom: 1,
  nomNormalise: 1,
  categorie: 1,
  caloriesKcalPour100g: 1,
  proteinesGPour100g: 1,
  glucidesGPour100g: 1,
  lipidesGPour100g: 1,
} as const;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class MongooseFoodRepository implements FoodRepositoryPort {
  constructor(
    @InjectModel(FoodDocumentClass.name)
    private readonly model: Model<FoodDocumentClass>,
  ) {}

  async search(
    nomNormalise: string,
    page: number,
    size: number,
    categorie?: FoodCategory,
  ): Promise<Food[]> {
    const filter = {
      ...(nomNormalise
        ? { nomNormalise: { $regex: escapeRegex(nomNormalise) } }
        : {}),
      ...(categorie ? { categorie } : {}),
    };
    const rows = await this.model
      .find(filter)
      .select(FOOD_PROJECTION)
      .sort({ nomNormalise: 1, _id: 1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean()
      .exec();
    return rows.map((row) =>
      Food.restore({
        id: row._id,
        nom: row.nom,
        nomNormalise: row.nomNormalise,
        categorie: row.categorie,
        caloriesKcalPour100g: row.caloriesKcalPour100g,
        proteinesGPour100g: row.proteinesGPour100g,
        glucidesGPour100g: row.glucidesGPour100g,
        lipidesGPour100g: row.lipidesGPour100g,
      }),
    );
  }

  async findById(id: string): Promise<Food | null> {
    const row = await this.model
      .findById(id)
      .select(FOOD_PROJECTION)
      .lean()
      .exec();
    return row
      ? Food.restore({
          id: row._id,
          nom: row.nom,
          nomNormalise: row.nomNormalise,
          categorie: row.categorie,
          caloriesKcalPour100g: row.caloriesKcalPour100g,
          proteinesGPour100g: row.proteinesGPour100g,
          glucidesGPour100g: row.glucidesGPour100g,
          lipidesGPour100g: row.lipidesGPour100g,
        })
      : null;
  }

  async findByIds(ids: string[]): Promise<Food[]> {
    if (ids.length === 0) return [];
    const rows = await this.model
      .find({ _id: { $in: ids } })
      .select(FOOD_PROJECTION)
      .lean()
      .exec();
    return rows.map((row) =>
      Food.restore({
        id: row._id,
        nom: row.nom,
        nomNormalise: row.nomNormalise,
        categorie: row.categorie,
        caloriesKcalPour100g: row.caloriesKcalPour100g,
        proteinesGPour100g: row.proteinesGPour100g,
        glucidesGPour100g: row.glucidesGPour100g,
        lipidesGPour100g: row.lipidesGPour100g,
      }),
    );
  }
}
