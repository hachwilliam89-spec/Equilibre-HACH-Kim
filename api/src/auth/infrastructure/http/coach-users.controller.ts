import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { USER_REPOSITORY } from '../../domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt.strategy';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { Roles } from '../../../common/auth/roles.decorator';

class CoachUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) tailleCm?: number;
  @ApiProperty({ required: false }) age?: number;
  @ApiProperty({ required: false, enum: ['homme', 'femme'] }) sexe?:
    'homme' | 'femme';
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachUsersController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  @Get('me/clients')
  @Roles('coach')
  @ApiOperation({ summary: 'Utilisateurs rattaches au coach connecte' })
  @ApiResponse({ status: 200, type: CoachUserDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Role coach requis' })
  async list(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<CoachUserDto[]> {
    const users = await this.users.findByCoachId(req.user.sub);
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      tailleCm: user.tailleCm,
      age: user.age,
      sexe: user.sexe,
    }));
  }
}
