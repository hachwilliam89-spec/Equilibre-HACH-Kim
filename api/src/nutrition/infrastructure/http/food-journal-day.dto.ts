import { z } from 'zod';

/** Jour calendaire UTC au format AAAA-MM-JJ, date réelle (pas de 2026-02-30). */
export const jourUtcSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format AAAA-MM-JJ',
  })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    },
    { message: 'Date inexistante' },
  );
