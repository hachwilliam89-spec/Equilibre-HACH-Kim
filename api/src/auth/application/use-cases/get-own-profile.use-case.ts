import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';

export interface OwnProfileResult {
  id: string;
  email: string;
  coach: { id: string; email: string };
  tailleCm?: number;
  age?: number;
  sexe?: 'homme' | 'femme';
}

@Injectable()
export class GetOwnProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string): Promise<OwnProfileResult> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== 'utilisateur' || !user.coachId) {
      throw new AppException(
        'user-not-found',
        'Utilisateur introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
    const coach = await this.users.findById(user.coachId);
    if (!coach || coach.role !== 'coach') {
      throw new AppException(
        'coach-not-found',
        'Coach de rattachement introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: user.id,
      email: user.email,
      coach: { id: coach.id, email: coach.email },
      tailleCm: user.tailleCm,
      age: user.age,
      sexe: user.sexe,
    };
  }
}
