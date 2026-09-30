import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateProfileSchema = z
  .object({
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
