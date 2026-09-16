import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
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

    const saltRounds = this.configService.get('BCRYPT_SALT_ROUNDS', {
      infer: true,
    });
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    // L'id doit etre un ObjectId Mongo valide : le repository fait un
    // upsert par _id (voir mongoose-user.repository.ts), pas une insertion
    // auto-generee.
    const id = new Types.ObjectId().toHexString();

    // User.create() applique deja la regle "utilisateur => coachId requis"
    // (deuxieme filet de securite, en plus de la validation Zod du DTO).
    const user = User.create({
      id,
      email: input.email,
      passwordHash,
      role: input.role,
      coachId: input.coachId,
      tailleCm: input.tailleCm,
      age: input.age,
      sexe: input.sexe,
      createdAt: new Date(),
    });

    const saved = await this.userRepository.create(user);
    return { userId: saved.id };
  }
}
