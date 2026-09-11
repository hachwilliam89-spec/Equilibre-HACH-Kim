import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { UserDocument, UserDocumentClass } from './user.schema';

@Injectable()
export class MongooseUserRepository implements UserRepositoryPort {
  constructor(
    @InjectModel(UserDocumentClass.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findById(id: string): Promise<User | null> {
    const doc = await this.userModel.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async save(user: User): Promise<User> {
    const props = user.toProps();
    const doc = await this.userModel.findByIdAndUpdate(
      props.id,
      { $set: props },
      { upsert: true, new: true },
    );
    return this.toDomain(doc);
  }

  /** Mappe un document Mongoose vers l'entité domaine pure */
  private toDomain(doc: UserDocument): User {
    return User.create({
      id: doc._id.toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      role: doc.role,
      tailleCm: doc.tailleCm,
      age: doc.age,
      sexe: doc.sexe,
      coachId: doc.coachId,
      createdAt: doc.createdAt,
    });
  }
}
