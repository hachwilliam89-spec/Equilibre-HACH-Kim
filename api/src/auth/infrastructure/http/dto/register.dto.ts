import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z
      .string()
      .email({ message: 'Email invalide' })
      .describe('Adresse email du compte'),
    password: z
      .string()
      .min(8, {
        message: 'Le mot de passe doit contenir au moins 8 caracteres',
      })
      // bcrypt ignore silencieusement tout octet au-dela du 72e : deux mots
      // de passe partageant les memes 72 premiers octets produiraient le
      // meme hash. On rejette explicitement plutot que de tronquer en
      // silence.
      .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
        message: 'Le mot de passe ne doit pas depasser 72 octets',
      })
      .describe('Mot de passe (8 a 72 octets)'),
    role: z.enum(['coach', 'utilisateur']).describe('Role du compte'),
    coachId: z
      .string()
      .optional()
      .describe('Identifiant du coach rattache (requis si role = utilisateur)'),
    tailleCm: z
      .number()
      .positive()
      .optional()
      .describe('Taille en cm (necessaire au calcul du BMR)'),
    age: z.number().int().positive().optional().describe('Age en annees'),
    sexe: z
      .enum(['homme', 'femme'])
      .optional()
      .describe('Sexe biologique (necessaire au calcul du BMR)'),
  })
  // Regle metier deja imposee par l'entite domaine User.create() : un
  // utilisateur doit etre rattache a un coach. On la valide ici aussi, en
  // amont, pour renvoyer une erreur 400 claire plutot qu'une exception
  // domaine generique.
  .refine((data) => data.role !== 'utilisateur' || !!data.coachId, {
    message: 'Un utilisateur doit etre rattache a un coach (coachId requis)',
    path: ['coachId'],
  });

export class RegisterDto extends createZodDto(registerSchema) {}
