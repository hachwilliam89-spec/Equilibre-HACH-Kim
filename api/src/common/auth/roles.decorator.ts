import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../auth/domain/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Restreint une route à un ou plusieurs rôles. A poser en plus de
 * @UseGuards(JwtAuthGuard, RolesGuard) -- sans JwtAuthGuard en amont,
 * req.user n'existe pas et RolesGuard refuse tout par construction.
 *
 * Exemple : @Roles('coach') @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
