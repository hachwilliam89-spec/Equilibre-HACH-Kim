import { User } from '../entities/user.entity';

/**
 * Port (interface) que le domaine attend d'un repository User.
 * L'implémentation concrète (Mongoose) vit dans infrastructure/persistence.
 */
export interface UserRepositoryPort {
  findByCoachId: (coachId: string) => Promise<User[]>;
  findByCoachCode: (code: string) => Promise<User | null>;
  ensureCoachCode: (id: string) => Promise<string>;
  findByEmail: (email: string) => Promise<User | null>;
  findById: (id: string) => Promise<User | null>;
  /** Insere un nouvel utilisateur. Echoue si l'id existe deja. */
  create: (user: User) => Promise<User>;
  /** Met a jour un utilisateur existant. Echoue si l'id n'existe pas. */
  save: (user: User) => Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
