import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .email({ message: 'Email invalide' })
    .describe('Adresse email du compte'),
  password: z
    .string()
    .min(8, { message: 'Le mot de passe doit contenir au moins 8 caracteres' })
    // Coherence avec register.dto.ts : bcrypt ignore silencieusement tout
    // octet au-dela du 72e, un mot de passe plus long que ca n'a jamais pu
    // etre enregistre tel quel -- meme limite ici pour rejeter clairement
    // plutot que de laisser bcrypt.compare tronquer en silence.
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
      message: 'Le mot de passe ne doit pas depasser 72 octets',
    })
    .describe('Mot de passe (8 a 72 octets)'),
});

// createZodDto genere a la fois le typage TS ET la documentation Swagger
// a partir du meme schema Zod -- une seule source de verite.
export class LoginDto extends createZodDto(loginSchema) {}

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, { message: 'refreshToken requis' })
    .describe('Refresh token obtenu au login'),
});

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
