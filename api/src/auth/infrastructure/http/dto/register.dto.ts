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
    coachCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^EQ-[A-F0-9]{8}$/)
      .optional()
      .describe('Code fourni par le coach, exemple EQ-7A9B2C4D'),
    coachId: z
      .string()
      .optional()
      .describe(
        'Identifiant du coach rattache (ancien champ compatible ; utiliser coachCode)',
      ),
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
  .refine(
    (data) => data.role !== 'utilisateur' || !!data.coachCode || !!data.coachId,
    {
      message:
        'Un utilisateur doit etre rattache a un coach (coachCode requis)',
      path: ['coachCode'],
    },
  )
  .refine((data) => !(data.coachCode && data.coachId), {
    message: 'Fournir uniquement coachCode',
    path: ['coachCode'],
  });

export class RegisterDto extends createZodDto(registerSchema) {}
