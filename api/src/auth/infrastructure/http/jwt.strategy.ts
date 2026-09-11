import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  role: 'coach' | 'utilisateur';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Passe par ConfigService (deja valide par Zod au demarrage) plutot que
      // process.env directement -- evite que la config technique fuite dans
      // l'infrastructure sans passer par la validation centralisee.
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Ce que retourne validate() devient req.user dans les controleurs
  validate(payload: JwtPayload): JwtPayload {
    return { sub: payload.sub, role: payload.role };
  }
}
