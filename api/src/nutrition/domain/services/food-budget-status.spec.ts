import { determinerStatutBudget } from './food-budget-status';

const journal = (totalCaloriesKcal: number, jourUtc = '2026-10-02') => ({
  jourUtc,
  totalCaloriesKcal,
  nombreEntrees: 1,
});

describe('Statut du budget calorique', () => {
  it('reste dans le budget à la borne +150 kcal, mais détecte un dépassement au-delà', () => {
    expect(determinerStatutBudget(1800, '2026-10-02', journal(1950))).toEqual({
      statut: 'dans-le-budget',
      ecartKcal: 150,
    });
    expect(
      determinerStatutBudget(1800, '2026-10-02', journal(1950.01)),
    ).toEqual({
      statut: 'depassement',
      ecartKcal: 150.01,
    });
  });

  it('conserve un écart signé négatif sans signaler de dépassement', () => {
    expect(determinerStatutBudget(1800, '2026-10-02', journal(1200))).toEqual({
      statut: 'dans-le-budget',
      ecartKcal: -600,
    });
  });

  it('utilise encore le dernier jour renseigné hier', () => {
    expect(
      determinerStatutBudget(1800, '2026-10-02', journal(2100, '2026-10-01')),
    ).toEqual({ statut: 'depassement', ecartKcal: 300 });
  });

  it('signale deux jours sans entrée, y compris lorsqu’un journal vide subsiste', () => {
    expect(
      determinerStatutBudget(1800, '2026-10-02', journal(2100, '2026-09-30')),
    ).toEqual({ statut: 'pas-de-donnees-recentes', ecartKcal: null });
    expect(determinerStatutBudget(1800, '2026-10-02', null)).toEqual({
      statut: 'pas-de-donnees-recentes',
      ecartKcal: null,
    });
    expect(
      determinerStatutBudget(1800, '2026-10-02', {
        ...journal(0),
        nombreEntrees: 0,
      }),
    ).toEqual({ statut: 'pas-de-donnees-recentes', ecartKcal: null });
  });
});
