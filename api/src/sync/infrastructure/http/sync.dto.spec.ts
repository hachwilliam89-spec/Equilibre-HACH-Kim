import { calculerCurseur, pushOperationsSchema } from './sync.dto';

describe('calculerCurseur', () => {
  const jour = new Date('2026-10-06T10:00:00Z');

  it('est stable pour un même contenu le même jour', () => {
    expect(calculerCurseur({ a: 1 }, jour)).toBe(
      calculerCurseur({ a: 1 }, new Date('2026-10-06T22:00:00Z')),
    );
  });

  it('change avec le contenu', () => {
    expect(calculerCurseur({ a: 1 }, jour)).not.toBe(
      calculerCurseur({ a: 2 }, jour),
    );
  });

  it('change avec le jour UTC (statuts dépendants de la date)', () => {
    expect(calculerCurseur({ a: 1 }, jour)).not.toBe(
      calculerCurseur({ a: 1 }, new Date('2026-10-07T00:00:00Z')),
    );
  });
});

describe('pushOperationsSchema', () => {
  const op = {
    id: '6f1d2b5e-8c0e-4c55-9f43-2d8f0b6a7c11',
    type: 'saisie-poids',
    mesureId: '0b7e3c9a-1f2d-4e5b-8a6c-7d9e0f1a2b3c',
    poidsKg: 79.2,
    saisiLe: '2026-10-06T07:30:00.000Z',
  };

  it('accepte un lot valide', () => {
    expect(pushOperationsSchema.safeParse({ operations: [op] }).success).toBe(
      true,
    );
  });

  it('refuse un champ inattendu', () => {
    expect(
      pushOperationsSchema.safeParse({
        operations: [{ ...op, userId: 'autre' }],
      }).success,
    ).toBe(false);
  });

  it('refuse deux opérations portant le même identifiant', () => {
    expect(
      pushOperationsSchema.safeParse({ operations: [op, op] }).success,
    ).toBe(false);
  });

  it('refuse un lot vide', () => {
    expect(pushOperationsSchema.safeParse({ operations: [] }).success).toBe(
      false,
    );
  });
});
