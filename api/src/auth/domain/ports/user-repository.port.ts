import { User } from '../entities/user.entity';

/**
 * Port (interface) que le domaine attend d'un repository User.
 * L'implémentation concrète (Mongoose) vit dans infrastructure/persistence.
 */
export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
