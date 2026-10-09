import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import type { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';

export interface CoachAccountResult {
  id: string;
  email: string;
  prenom?: string;
  nom?: string;
  coachCode: string;
}

export interface CoachIdentityInput {
  prenom?: string;
  nom?: string;
}

/** Compte du coach connecté : identité et code de rattachement. */
@Injectable()
export class CoachAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
  ) {}

  async get(coachId: string): Promise<CoachAccountResult> {
    return this.toResult(await this.loadCoach(coachId));
  }

  async updateIdentity(
    coachId: string,
    identity: CoachIdentityInput,
  ): Promise<CoachAccountResult> {
    const coach = await this.loadCoach(coachId);
    const saved = await this.users.save(coach.withProfile(identity));
    return this.toResult(saved);
  }

  private async loadCoach(coachId: string): Promise<User> {
    const coach = await this.users.findById(coachId);
    if (!coach || coach.role !== 'coach') {
      throw new AppException(
        'coach-not-found',
        'Coach introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
    return coach;
  }

  private async toResult(coach: User): Promise<CoachAccountResult> {
    return {
      id: coach.id,
      email: coach.email,
      prenom: coach.prenom,
      nom: coach.nom,
      coachCode: await this.users.ensureCoachCode(coach.id),
    };
  }
}
