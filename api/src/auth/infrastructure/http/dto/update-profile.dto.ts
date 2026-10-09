import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { nomSchema, prenomSchema } from './identity.schema';

export const updateProfileSchema = z
  .object({
    prenom: prenomSchema.optional(),
    nom: nomSchema.optional(),
    tailleCm: z.number().positive().optional().describe('Taille en cm'),
    age: z.number().int().positive().optional().describe('Age en annees'),
    sexe: z.enum(['homme', 'femme']).optional().describe('Sexe biologique'),
  })
  .refine(
    (profile) => Object.values(profile).some((value) => value !== undefined),
    {
      message: 'Au moins une information de profil est requise',
    },
  );

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
