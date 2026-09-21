import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class PlanPreviewDto extends createZodDto(
  z.object({
    userId: z.string(),
    poidsDepart: z.number(),
    poidsCible: z.number(),
    dateDebut: z.iso.datetime(),
    dateCible: z.iso.datetime(),
    imcCible: z.number(),
    niveauActivite: z.enum(['sedentaire', 'actif', 'sportif', 'athlete']),
    budgetCalorique: z.number(),
    budgetPlafonneAuBmr: z.boolean(),
    avertissement: z.string().nullable(),
  }),
) {}
