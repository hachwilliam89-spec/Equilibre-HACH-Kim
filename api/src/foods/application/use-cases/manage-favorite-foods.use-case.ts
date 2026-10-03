import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FOOD_REPOSITORY,
  type FoodRepositoryPort,
} from '../../domain/ports/food-repository.port';
import {
  FAVORITE_FOODS_REPOSITORY,
  type FavoriteFoodsRepositoryPort,
} from '../../domain/ports/favorite-foods-repository.port';
import { Food } from '../../domain/entities/food.entity';

@Injectable()
export class ManageFavoriteFoodsUseCase {
  constructor(
    @Inject(FOOD_REPOSITORY) private readonly foods: FoodRepositoryPort,
    @Inject(FAVORITE_FOODS_REPOSITORY)
    private readonly favorites: FavoriteFoodsRepositoryPort,
  ) {}

  async list(userId: string): Promise<Food[]> {
    const ids = await this.favorites.listIds(userId);
    const foods = await this.foods.findByIds(ids);
    return foods.sort((a, b) =>
      a.toProps().nom.localeCompare(b.toProps().nom, 'fr'),
    );
  }

  async add(userId: string, foodId: string): Promise<void> {
    if (!(await this.foods.findById(foodId))) {
      throw new NotFoundException('Aliment introuvable');
    }
    await this.favorites.add(userId, foodId);
  }

  remove(userId: string, foodId: string): Promise<void> {
    return this.favorites.remove(userId, foodId);
  }
}
