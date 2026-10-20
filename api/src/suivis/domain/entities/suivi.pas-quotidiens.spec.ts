import { AppException } from '../../../common/errors/app-exception';
import { Suivi } from './suivi.entity';

describe('Suivi.enregistrerPas (US4)', () => {
  it('enregistre le total du jour UTC de réception sans plan actif', () => {
    const suivi = Suivi.create('user-id');

    const jour = suivi.enregistrerPas(8400, new Date('2026-10-08T21:30:00Z'));

    expect(jour).toEqual({
      jourUtc: '2026-10-08',
      nombrePas: 8400,
      recuLe: new Date('2026-10-08T21:30:00Z'),
    });
    expect(suivi.toProps().pasQuotidiens).toHaveLength(1);
  });

  it('remplace la valeur du même jour par le nouveau total', () => {
    const suivi = Suivi.create('user-id');
    suivi.enregistrerPas(3000, new Date('2026-10-08T12:00:00Z'));
    suivi.enregistrerPas(9100, new Date('2026-10-08T22:00:00Z'));
    suivi.enregistrerPas(7000, new Date('2026-10-09T22:00:00Z'));

    expect(
      suivi.toProps().pasQuotidiens.map(({ jourUtc, nombrePas }) => ({
        jourUtc,
        nombrePas,
      })),
    ).toEqual([
      { jourUtc: '2026-10-08', nombrePas: 9100 },
      { jourUtc: '2026-10-09', nombrePas: 7000 },
    ]);
  });

  it('accepte 0 et 50 000 pas, refuse les valeurs hors bornes ou décimales', () => {
    const suivi = Suivi.create('user-id');
    const maintenant = new Date('2026-10-08T12:00:00Z');
    expect(suivi.enregistrerPas(0, maintenant).nombrePas).toBe(0);
    expect(suivi.enregistrerPas(50000, maintenant).nombrePas).toBe(50000);
    for (const valeur of [-1, 50001, 80000, 1200.5]) {
      expect(() => suivi.enregistrerPas(valeur, maintenant)).toThrow(
        AppException,
      );
    }
    expect(suivi.toProps().pasQuotidiens).toEqual([
      { jourUtc: '2026-10-08', nombrePas: 50000, recuLe: maintenant },
    ]);
  });

  it('ne conserve que trois mois de pas', () => {
    const suivi = Suivi.create('user-id');
    suivi.enregistrerPas(5000, new Date('2026-07-01T12:00:00Z'));
    suivi.enregistrerPas(6000, new Date('2026-07-15T12:00:00Z'));
    suivi.enregistrerPas(7000, new Date('2026-10-08T12:00:00Z'));

    expect(suivi.toProps().pasQuotidiens.map((jour) => jour.jourUtc)).toEqual([
      '2026-07-15',
      '2026-10-08',
    ]);
  });

  it('restaure un document antérieur à l’US4 sans pas', () => {
    const ancien: Parameters<typeof Suivi.restore>[0] = {
      ...Suivi.create('user-id').toProps(),
    };
    delete ancien.pasQuotidiens;
    expect(Suivi.restore(ancien).toProps().pasQuotidiens).toEqual([]);
  });
});
