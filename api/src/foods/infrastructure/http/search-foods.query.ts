import { z } from 'zod';

const positivePage = z
  .string()
  .regex(/^[1-9]\d*$/, 'Entier positif attendu')
  .default('1')
  .transform(Number)
  .pipe(z.number().int().max(1000));

const pageSize = z
  .string()
  .regex(/^[1-9]\d*$/, 'Entier positif attendu')
  .default('20')
  .transform(Number)
  .pipe(z.number().int().max(50));

export const searchFoodsQuerySchema = z
  .object({
    q: z.string().max(100).default(''),
    page: positivePage,
    size: pageSize,
  })
  .strict();

export type SearchFoodsQuery = z.output<typeof searchFoodsQuerySchema>;
