import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/ports/refresh-token-repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token-repository.port';
import { RefreshTokenRecord } from '../../domain/entities/refresh-token-record.entity';
import { AppException } from '../../../common/errors/app-exception';
import { hashToken } from '../../../common/security/hash-token';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  role: 'coach' | 'utilisateur';
  userId: string;
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AppException(
        'invalid-credentials',
        'Identifiants invalides',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppException(
        'invalid-credentials',
        'Identifiants invalides',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Trace le refresh token emis, pour pouvoir le revoquer plus tard (logout).
    const record = RefreshTokenRecord.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revoked: false,
      createdAt: new Date(),
    });
    await this.refreshTokenRepository.save(record);

    return { accessToken, refreshToken, role: user.role, userId: user.id };
  }
}
