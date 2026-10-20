import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const planDateSchema = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .pipe(z.coerce.date());

export const updatePlanSchema = z
  .object({
    poidsCible: z
      .number()
      .positive()
      .optional()
      .describe('Nouveau poids cible, en kg'),
    dateCible: planDateSchema.optional().describe('Nouvelle date cible'),
    budgetCalorique: z
      .number()
      .positive()
      .optional()
      .describe(
        'Budget impose par le coach ; si absent, recalcule quand le poids cible ou la date cible change',
      ),
  })
  .strict()
  .refine(
    (body) =>
      body.poidsCible !== undefined ||
      body.dateCible !== undefined ||
      body.budgetCalorique !== undefined,
    { message: 'Au moins un champ a ajuster est requis' },
  );

export class UpdatePlanDto extends createZodDto(updatePlanSchema) {}
