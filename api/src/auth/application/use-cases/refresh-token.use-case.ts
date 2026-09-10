import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { AppException } from '../../../common/errors/app-exception';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: string; role: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
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
