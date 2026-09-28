import { Measurement, MeasurementCreateProps } from './measurement.entity';

const input = (): MeasurementCreateProps => ({
  id: 'measurement',
  userId: 'user',
  planId: 'plan',
  poidsKg: 72.5,
  receivedAt: new Date('2026-09-24T00:30:00+02:00'),
  source: 'automatique',
  statut: 'valide',
});

describe('Measurement', () => {
  it('dérive le jour UTC de la réception et préserve toutes les données', () => {
    expect(Measurement.create(input()).toProps()).toEqual({
      ...input(),
      jourUtc: '2026-09-23',
    });
  });

  it.each([0, -1, NaN, Infinity, -Infinity, '72', null, undefined])(
    'refuse le poids invalide %s',
    (poidsKg) => {
      expect(() =>
        Measurement.create({ ...input(), poidsKg: poidsKg as number }),
      ).toThrow();
    },
  );

  it.each(['id', 'userId', 'planId'] as const)('exige %s', (key) => {
    for (const value of ['', '  ', undefined]) {
      expect(() => Measurement.create({ ...input(), [key]: value })).toThrow();
    }
  });

  it.each(['valide', 'suspecte', 'hors-plan'] as const)(
    'conserve le statut %s pour les deux sources',
    (statut) => {
      for (const source of ['automatique', 'manuelle'] as const) {
        const measurement = Measurement.create({ ...input(), source, statut });
        expect(Measurement.restore(measurement.toProps()).toProps()).toEqual(
          measurement.toProps(),
        );
      }
    },
  );

  it('refuse les dates, sources, statuts et jours incohérents', () => {
    expect(() =>
      Measurement.create({ ...input(), receivedAt: new Date('invalid') }),
    ).toThrow();
    expect(() =>
      Measurement.create({ ...input(), source: 'autre' as never }),
    ).toThrow();
    expect(() =>
      Measurement.create({ ...input(), statut: 'autre' as never }),
    ).toThrow();
    expect(() =>
      Measurement.restore({ ...input(), jourUtc: '2026-09-24' }),
    ).toThrow();
  });

  it('protège la réception contre les mutations externes', () => {
    const props = input();
    const measurement = Measurement.create(props);
    props.receivedAt.setUTCFullYear(2000);
    measurement.toProps().receivedAt.setUTCFullYear(2001);
    expect(measurement.toProps().receivedAt.toISOString()).toBe(
      '2026-09-23T22:30:00.000Z',
    );
  });
});
