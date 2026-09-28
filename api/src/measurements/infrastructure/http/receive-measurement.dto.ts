import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const receiveMeasurementSchema = z
  .object({
    poidsKg: z
      .number()
      .positive()
      .describe('Poids en kilogrammes, strictement positif'),
  })
  .strict();

export class ReceiveMeasurementDto extends createZodDto(
  receiveMeasurementSchema,
) {}
