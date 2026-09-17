import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard à poser sur toute route protégée : @UseGuards(JwtAuthGuard)
 * Déclenche automatiquement JwtStrategy (le nom 'jwt' correspond au nom par
 * défaut de la stratégie passport-jwt, pas besoin de le déclarer explicitement).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
