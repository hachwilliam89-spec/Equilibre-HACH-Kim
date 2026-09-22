import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { User } from '../../domain/entities/user.entity';
import { AppException } from '../../../common/errors/app-exception';
import type { EnvConfig } from '../../../config/env.schema';

export interface RegisterInput {
  email: string;
  password: string;
  role: 'coach' | 'utilisateur';
  coachId?: string;
  coachCode?: string;
  tailleCm?: number;
  age?: number;
  sexe?: 'homme' | 'femme';
}

export interface RegisterResult {
  userId: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppException(
        'email-already-used',
        'Cet email est deja utilise',
        HttpStatus.CONFLICT,
      );
    }

    // Un utilisateur doit etre rattache a un coach existant, pas a une
    // simple chaine arbitraire : le DTO ne valide que la forme de coachId,
    // pas son existence ni son role.
    let coachId: string | undefined;
    if (input.role === 'utilisateur') {
      const coach = input.coachCode
        ? await this.userRepository.findByCoachCode(
            input.coachCode.trim().toUpperCase(),
          )
        : input.coachId
          ? await this.userRepository.findById(input.coachId)
          : null;
      if (!coach || coach.role !== 'coach') {
        throw new AppException(
          'invalid-coach',
          'Coach introuvable',
          HttpStatus.BAD_REQUEST,
        );
      }
      coachId = coach.id;
    }

    const saltRounds = this.configService.get('BCRYPT_SALT_ROUNDS', {
      infer: true,
    });
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    // Id opaque genere par l'application, pas un ObjectId Mongo (voir
    // user.schema.ts : _id est stocke comme une simple chaine).
    const id = randomUUID();

    // User.create() applique deja la regle "utilisateur => coachId requis"
    // (deuxieme filet de securite, en plus de la validation Zod du DTO).
    const user = User.create({
      id,
      email: input.email,
      passwordHash,
      role: input.role,
      coachId,
      tailleCm: input.tailleCm,
      age: input.age,
      sexe: input.sexe,
      createdAt: new Date(),
    });

    const saved = await this.userRepository.create(user);
    return { userId: saved.id };
  }
}
