import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocumentClass } from '../../../auth/infrastructure/persistence/user.schema';
import { FavoriteFoodsRepositoryPort } from '../../domain/ports/favorite-foods-repository.port';

@Injectable()
export class MongooseFavoriteFoodsRepository implements FavoriteFoodsRepositoryPort {
  constructor(
    @InjectModel(UserDocumentClass.name)
    private readonly users: Model<UserDocumentClass>,
  ) {}

  async listIds(userId: string): Promise<string[]> {
    const user = await this.users
      .findOne({ _id: userId, role: 'utilisateur' })
      .select({ favoriteFoodIds: 1 })
      .lean()
      .exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user.favoriteFoodIds ?? [];
  }

  async add(userId: string, foodId: string): Promise<void> {
    const result = await this.users
      .updateOne(
        { _id: userId, role: 'utilisateur' },
        { $addToSet: { favoriteFoodIds: foodId } },
      )
      .exec();
    if (!result.matchedCount)
      throw new NotFoundException('Utilisateur introuvable');
  }

  async remove(userId: string, foodId: string): Promise<void> {
    const result = await this.users
      .updateOne(
        { _id: userId, role: 'utilisateur' },
        { $pull: { favoriteFoodIds: foodId } },
      )
      .exec();
    if (!result.matchedCount)
      throw new NotFoundException('Utilisateur introuvable');
  }
}
