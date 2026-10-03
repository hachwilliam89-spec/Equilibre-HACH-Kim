import { Food, type FoodCategory } from '../entities/food.entity';

export interface FoodRepositoryPort {
  search(
    nomNormalise: string,
    page: number,
    size: number,
    categorie?: FoodCategory,
  ): Promise<Food[]>;
  findById(id: string): Promise<Food | null>;
  findByIds(ids: string[]): Promise<Food[]>;
}

export const FOOD_REPOSITORY = Symbol('FOOD_REPOSITORY');
