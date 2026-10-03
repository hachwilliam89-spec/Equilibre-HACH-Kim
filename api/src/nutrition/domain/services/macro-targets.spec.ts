import { ciblesMacros, objectifDepuisPoids } from './macro-targets';

describe('ciblesMacros', () => {
  it('derive proteines, lipides et glucides du budget, du poids et de l objectif', () => {
    const cibles = ciblesMacros({
      budgetCalorique: 1800,
      poidsKg: 82,
      objectif: 'perte',
      niveauActivite: 'actif',
    });
    // proteines : (1,8 + 0,2) x 82 = 164 g
    expect(cibles.proteinesG).toBe(164);
    // lipides : max(0,8 x 82 = 65,6 ; 0,25 x 1800 / 9 = 50) -> 66 g
    expect(cibles.lipidesG).toBe(66);
    // glucides : (1800 - 164x4 - 66x9) / 4 = 550 / 4 -> 138 g
    expect(cibles.glucidesG).toBe(138);
  });

  it('augmente les proteines avec le niveau d activite', () => {
    const base = {
      budgetCalorique: 2000,
      poidsKg: 70,
      objectif: 'maintien' as const,
    };
    const sedentaire = ciblesMacros({ ...base, niveauActivite: 'sedentaire' });
    const athlete = ciblesMacros({ ...base, niveauActivite: 'athlete' });
    expect(athlete.proteinesG).toBeGreaterThan(sedentaire.proteinesG);
  });

  it('ne renvoie jamais de glucides negatifs', () => {
    const cibles = ciblesMacros({
      budgetCalorique: 1200,
      poidsKg: 120,
      objectif: 'perte',
      niveauActivite: 'athlete',
    });
    expect(cibles.glucidesG).toBeGreaterThanOrEqual(0);
  });

  it('deduit l objectif du sens de la variation de poids', () => {
    expect(objectifDepuisPoids(80, 75)).toBe('perte');
    expect(objectifDepuisPoids(70, 74)).toBe('prise');
    expect(objectifDepuisPoids(80, 80)).toBe('maintien');
  });
});
