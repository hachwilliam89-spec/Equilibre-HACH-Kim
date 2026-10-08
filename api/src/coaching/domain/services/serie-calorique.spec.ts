import { serieCalorique, type TotauxJournaliers } from './serie-calorique';

const jour = (
  jourUtc: string,
  totalCaloriesKcal: number,
  nombreEntrees = 1,
): TotauxJournaliers => ({
  jourUtc,
  totalCaloriesKcal,
  totalProteinesG: 10,
  totalGlucidesG: 20,
  totalLipidesG: 5,
  nombreEntrees,
});

describe('serieCalorique', () => {
  it('renvoie 7 jours du plus ancien au plus récent, jours manquants à 0', () => {
    const serie = serieCalorique(
      [jour('2026-10-08', 1700)],
      1800,
      '2026-10-08',
    );
    expect(serie.map((j) => j.jourUtc)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]);
    expect(serie[0]).toMatchObject({
      totalCaloriesKcal: 0,
      nombreEntrees: 0,
      ecartKcal: null,
      statut: 'aucune-entree',
    });
    expect(serie[6]).toMatchObject({
      totalCaloriesKcal: 1700,
      ecartKcal: -100,
      statut: 'dans-le-budget',
    });
  });

  it('applique la tolérance de 150 kcal, borne incluse', () => {
    const serie = serieCalorique(
      [jour('2026-10-07', 1950), jour('2026-10-08', 1951)],
      1800,
      '2026-10-08',
      2,
    );
    expect(serie.map((j) => j.statut)).toEqual([
      'dans-le-budget',
      'depassement',
    ]);
    expect(serie[1].ecartKcal).toBe(151);
  });

  it('traite un journal vidé comme un jour sans entrée', () => {
    const serie = serieCalorique(
      [jour('2026-10-08', 0, 0)],
      1800,
      '2026-10-08',
      1,
    );
    expect(serie[0].statut).toBe('aucune-entree');
  });

  it('franchit correctement un changement de mois', () => {
    const serie = serieCalorique([], 1800, '2026-11-02', 3);
    expect(serie.map((j) => j.jourUtc)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});
