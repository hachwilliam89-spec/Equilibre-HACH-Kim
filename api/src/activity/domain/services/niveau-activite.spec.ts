import {
  moyenneSeptJours,
  niveauDepuisMoyenne,
  type PasQuotidien,
} from './niveau-activite';

function semaine(valeurs: number[], fin = '2026-10-07'): PasQuotidien[] {
  return valeurs.map((nombrePas, index) => {
    const jour = new Date(
      Date.parse(`${fin}T00:00:00.000Z`) -
        (valeurs.length - 1 - index) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    return { jourUtc: jour, nombrePas, recuLe: new Date(`${jour}T20:00:00Z`) };
  });
}

describe('niveau d’activité (US4)', () => {
  it('calcule la moyenne des 7 jours précédents : exemple de l’US1', () => {
    const pas = semaine([8000, 8200, 8400, 8100, 8300, 7900, 8500]);
    expect(moyenneSeptJours(pas, '2026-10-08')).toEqual({
      debut: '2026-10-01',
      fin: '2026-10-07',
      joursRenseignes: 7,
      moyennePas: 8200,
      niveau: 'sportif',
    });
  });

  it('applique les paliers, bornes basses incluses', () => {
    expect(niveauDepuisMoyenne(4999)).toBe('sedentaire');
    expect(niveauDepuisMoyenne(5000)).toBe('actif');
    expect(niveauDepuisMoyenne(7499)).toBe('actif');
    expect(niveauDepuisMoyenne(7500)).toBe('sportif');
    expect(niveauDepuisMoyenne(9999)).toBe('sportif');
    expect(niveauDepuisMoyenne(10000)).toBe('athlete');
  });

  it.each([
    [5000, 'actif'],
    [7500, 'sportif'],
    [10000, 'athlete'],
  ] as const)('7 jours à %i pas : %s', (valeur, niveau) => {
    const pas = semaine(Array<number>(7).fill(valeur));
    expect(moyenneSeptJours(pas, '2026-10-08').niveau).toBe(niveau);
  });

  it('ne déduit rien avec moins de 7 jours renseignés', () => {
    const pas = semaine([8000, 8200, 8400]);
    expect(moyenneSeptJours(pas, '2026-10-08')).toMatchObject({
      joursRenseignes: 3,
      moyennePas: null,
      niveau: null,
    });
  });

  it('ignore la journée en cours et les jours hors fenêtre', () => {
    const pas = [
      ...semaine(Array<number>(6).fill(12000)),
      {
        jourUtc: '2026-10-08',
        nombrePas: 20000,
        recuLe: new Date('2026-10-08T09:00:00Z'),
      },
      {
        jourUtc: '2026-09-30',
        nombrePas: 20000,
        recuLe: new Date('2026-09-30T09:00:00Z'),
      },
    ];
    expect(moyenneSeptJours(pas, '2026-10-08')).toMatchObject({
      joursRenseignes: 6,
      niveau: null,
    });
  });
});
