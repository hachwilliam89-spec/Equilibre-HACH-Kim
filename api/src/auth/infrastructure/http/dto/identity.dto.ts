import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { nomSchema, prenomSchema } from './identity.schema';

/** Modification de l'identité d'un compte coach (prénom et/ou nom). */
export const updateIdentitySchema = z
  .object({
    prenom: prenomSchema.optional(),
    nom: nomSchema.optional(),
  })
  .refine((body) => body.prenom !== undefined || body.nom !== undefined, {
    message: 'Prenom ou nom requis',
  });

export class UpdateIdentityDto extends createZodDto(updateIdentitySchema) {}
