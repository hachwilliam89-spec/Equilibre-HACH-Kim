import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/ports/refresh-token-repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token-repository.port';
import { hashToken } from '../../../common/security/hash-token';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepositoryPort,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    // Revocation idempotente : si le token n'existe pas ou est deja revoque,
    // pas d'erreur -- un logout doit toujours "reussir" du point de vue du
    // client, meme si le token etait deja invalide.
    await this.refreshTokenRepository.revokeByTokenHash(
      hashToken(refreshToken),
    );
  }
}
