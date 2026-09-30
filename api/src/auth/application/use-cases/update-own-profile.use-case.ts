import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import type { UserProfile } from '../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import {
  GetOwnProfileUseCase,
  type OwnProfileResult,
} from './get-own-profile.use-case';

@Injectable()
export class UpdateOwnProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    private readonly getOwnProfile: GetOwnProfileUseCase,
  ) {}

  async execute(
    userId: string,
    profile: UserProfile,
  ): Promise<OwnProfileResult> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== 'utilisateur') {
      throw new AppException(
        'user-not-found',
        'Utilisateur introuvable',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.users.save(user.withProfile(profile));
    return this.getOwnProfile.execute(userId);
  }
}
