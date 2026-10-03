import { Inject, Injectable } from '@nestjs/common';
import {
  normalizeFoodName,
  type Food,
  type FoodCategory,
} from '../../domain/entities/food.entity';
import {
  FOOD_REPOSITORY,
  type FoodRepositoryPort,
} from '../../domain/ports/food-repository.port';

@Injectable()
export class SearchFoodsUseCase {
  constructor(
    @Inject(FOOD_REPOSITORY) private readonly foods: FoodRepositoryPort,
  ) {}

  execute(
    q: string,
    page: number,
    size: number,
    categorie?: FoodCategory,
  ): Promise<Food[]> {
    return this.foods.search(normalizeFoodName(q), page, size, categorie);
  }
}
