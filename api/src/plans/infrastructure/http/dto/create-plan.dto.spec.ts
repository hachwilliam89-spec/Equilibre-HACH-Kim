import { z } from 'zod';
import { createPlanSchema } from './create-plan.dto';

const input = {
  userId: 'user-test',
  poidsDepart: 82,
  poidsCible: 80,
  dateDebut: '2026-10-01',
  dateCible: '2026-10-29',
  niveauActivite: 'sportif',
};

describe('Contrat HTTP du plan', () => {
  it('expose les dates ISO dans le schéma JSON utilisé par Swagger', () => {
    const schema = z.toJSONSchema(createPlanSchema, { io: 'input' });
    expect(schema.properties?.dateDebut).toMatchObject({
      anyOf: [
        { type: 'string', format: 'date' },
        { type: 'string', format: 'date-time' },
      ],
    });
    expect(schema.properties?.dateCible).toBeDefined();
  });

  it.each([
    ['2026-10-01', '2026-10-29'],
    ['2026-10-01T00:00:00Z', '2026-10-29T00:00:00Z'],
    ['2026-10-01T00:00:00+02:00', '2026-10-29T00:00:00+02:00'],
  ])('convertit %s en Date pour les calculs métier', (dateDebut, dateCible) => {
    const result = createPlanSchema.parse({ ...input, dateDebut, dateCible });
    expect(result.dateDebut).toEqual(new Date(dateDebut));
    expect(result.dateCible).toEqual(new Date(dateCible));
  });

  it.each(['2026-02-30', 'invalide', '', null, 123])(
    'refuse une date HTTP invalide : %s',
    (dateDebut) => {
      expect(createPlanSchema.safeParse({ ...input, dateDebut }).success).toBe(
        false,
      );
    },
  );

  it.each(['2026-10-01', '2026-09-30'])(
    'refuse une date cible égale ou antérieure : %s',
    (dateCible) => {
      expect(createPlanSchema.safeParse({ ...input, dateCible }).success).toBe(
        false,
      );
    },
  );
});
