import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addFoodEntrySchema = z
  .object({
    foodId: z.uuid(),
    quantiteGrammes: z.number().positive().finite().max(10000),
  })
  .strict();

export class AddFoodEntryDto extends createZodDto(addFoodEntrySchema) {}
