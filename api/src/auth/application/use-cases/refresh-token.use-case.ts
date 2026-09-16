import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/ports/refresh-token-repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token-repository.port';
import { RefreshTokenRecord } from '../../domain/entities/refresh-token-record.entity';
import { AppException } from '../../../common/errors/app-exception';
import { hashToken } from '../../../common/security/hash-token';
import type { EnvConfig } from '../../../config/env.schema';
import { REFRESH_TOKEN_TTL_MS } from '../auth.constants';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

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

  async execute(refreshToken: string): Promise<RefreshResult> {
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
    const oldTokenHash = hashToken(refreshToken);
    const record =
      await this.refreshTokenRepository.findByTokenHash(oldTokenHash);
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

    // Rotation : l'ancien refresh token est revoque immediatement et remplace
    // par un nouveau. S'il est rejoue plus tard (vol/fuite), il echouera au
    // lieu de rester valide jusqu'a expiration naturelle (7 jours).
    await this.refreshTokenRepository.revokeByTokenHash(oldTokenHash);

    const newPayload = { sub: user.id, role: user.role };
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET', {
      infer: true,
    });
    const accessToken = this.jwtService.sign(newPayload, {
      expiresIn: '15m',
    });

    // jti unique par jeton, voir LoginUseCase pour le detail : sans lui, deux
    // rotations dans la meme seconde pour le meme utilisateur produiraient
    // un JWT identique.
    const newRefreshTokenId = randomUUID();
    const newRefreshToken = this.jwtService.sign(
      { ...newPayload, jti: newRefreshTokenId },
      {
        expiresIn: '7d',
        secret: refreshSecret,
      },
    );

    const newRecord = RefreshTokenRecord.create({
      id: newRefreshTokenId,
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revoked: false,
      createdAt: new Date(),
    });
    await this.refreshTokenRepository.save(newRecord);

    return { accessToken, refreshToken: newRefreshToken };
  }
}
