import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/ports/refresh-token-repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token-repository.port';
import { AppException } from '../../../common/errors/app-exception';
import { hashToken } from '../../../common/security/hash-token';
import type { EnvConfig } from '../../../config/env.schema';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepositoryPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async execute(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: string; role: string };
    try {
      // Meme secret que celui utilise pour signer le refresh token au login
      // (JWT_REFRESH_SECRET), distinct de celui de l'access token.
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new AppException(
        'invalid-refresh-token',
        'Refresh token invalide ou expire',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Verifie que ce token n'a pas ete revoque (logout) depuis son emission --
    // la seule verification de signature JWT ne suffit pas, un token
    // techniquement valide mais revoque doit etre rejete.
    const record = await this.refreshTokenRepository.findByTokenHash(
      hashToken(refreshToken),
    );
    if (!record || !record.isValid()) {
      throw new AppException(
        'invalid-refresh-token',
        'Refresh token invalide ou expire',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new AppException(
        'user-not-found',
        'Utilisateur introuvable',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role },
      { expiresIn: '15m' },
    );

    return { accessToken };
  }
}
