import { Food } from '../entities/food.entity';

export interface FoodRepositoryPort {
  search(nomNormalise: string, page: number, size: number): Promise<Food[]>;
  findById(id: string): Promise<Food | null>;
}

export const FOOD_REPOSITORY = Symbol('FOOD_REPOSITORY');
