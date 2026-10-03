export interface FavoriteFoodsRepositoryPort {
  listIds(userId: string): Promise<string[]>;
  add(userId: string, foodId: string): Promise<void>;
  remove(userId: string, foodId: string): Promise<void>;
}

export const FAVORITE_FOODS_REPOSITORY = Symbol('FAVORITE_FOODS_REPOSITORY');
