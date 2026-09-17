import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { UserDocument, UserDocumentClass } from './user.schema';
import { AppException } from '../../../common/errors/app-exception';

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

  /** Insertion d'un nouvel utilisateur (voir RegisterUseCase). */
  async create(user: User): Promise<User> {
    const props = user.toProps();
    const doc = await this.userModel.create({
      _id: props.id,
      email: props.email,
      passwordHash: props.passwordHash,
      role: props.role,
      tailleCm: props.tailleCm,
      age: props.age,
      sexe: props.sexe,
      coachId: props.coachId,
    });
    return this.toDomain(doc);
  }

  /**
   * Mise a jour d'un utilisateur existant. Pas d'upsert ici : un id qui ne
   * correspond a aucun document est une erreur (bug appelant), pas une
   * creation implicite -- l'upsert precedent pouvait creer un document
   * inattendu si l'id n'existait pas.
   */
  async save(user: User): Promise<User> {
    const props = user.toProps();
    const doc = await this.userModel.findByIdAndUpdate(
      props.id,
      { $set: props },
      { returnDocument: 'after' },
    );
    if (!doc) {
      throw new AppException(
        'user-not-found',
        'Utilisateur introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
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
