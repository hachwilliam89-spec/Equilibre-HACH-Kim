import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MEAL_CATEGORIES } from '../../domain/entities/food-entry.entity';

export const addFoodEntrySchema = z
  .object({
    foodId: z.uuid(),
    quantiteGrammes: z.number().positive().finite().max(10000),
    categorieRepas: z.enum(MEAL_CATEGORIES).optional(),
  })
  .strict();

export class AddFoodEntryDto extends createZodDto(addFoodEntrySchema) {}
