import {
  calculateBmr,
  calculateCalorieBudget,
  calculateImc,
  calculateWeeklyRateKgPerWeek,
  ACTIVITY_FACTORS,
} from './metabolic-calculations';

describe('calculateImc', () => {
  it("calcule l'IMC (poids / taille en metre au carre)", () => {
    expect(calculateImc(53.5, 170)).toBeCloseTo(18.5, 1);
  });

  it('detecte un IMC de denutrition', () => {
    expect(calculateImc(45, 170)).toBeLessThan(18.5);
  });

  it('accepte un IMC eleve sans plafond', () => {
    expect(calculateImc(93, 170)).toBeGreaterThan(30);
  });
});

describe('calculateWeeklyRateKgPerWeek', () => {
  it('calcule un rythme negatif en perte de poids', () => {
    const rate = calculateWeeklyRateKgPerWeek(
      82,
      78,
      new Date('2026-01-01'),
      new Date('2026-01-29'), // 4 semaines
    );
    expect(rate).toBeCloseTo(-1, 5);
  });

  it('calcule un rythme positif en prise de masse', () => {
    const rate = calculateWeeklyRateKgPerWeek(
      70,
      72,
      new Date('2026-01-01'),
      new Date('2026-01-29'), // 4 semaines
    );
    expect(rate).toBeCloseTo(0.5, 5);
  });
});

describe('calculateBmr (Mifflin-St Jeor)', () => {
  it('calcule le BMR pour une femme', () => {
    // 10*82 + 6.25*170 - 5*30 - 161 = 820 + 1062.5 - 150 - 161 = 1571.5
    const bmr = calculateBmr({
      sexe: 'femme',
      poidsKg: 82,
      tailleCm: 170,
      age: 30,
    });
    expect(bmr).toBeCloseTo(1571.5, 5);
  });

  it('calcule le BMR pour un homme', () => {
    // 10*82 + 6.25*170 - 5*30 + 5 = 820 + 1062.5 - 150 + 5 = 1737.5
    const bmr = calculateBmr({
      sexe: 'homme',
      poidsKg: 82,
      tailleCm: 170,
      age: 30,
    });
    expect(bmr).toBeCloseTo(1737.5, 5);
  });
});

describe('ACTIVITY_FACTORS', () => {
  it.each([
    ['sedentaire', 1.2],
    ['actif', 1.375],
    ['sportif', 1.55],
    ['athlete', 1.725],
  ] as const)('facteur %s = %f', (niveau, facteur) => {
    expect(ACTIVITY_FACTORS[niveau]).toBe(facteur);
  });
});

describe('calculateCalorieBudget', () => {
  it("suggere un deficit derive du rythme de perte (formule de l'AC)", () => {
    // Femme, 30 ans, 82kg, 1.70m, niveau Sportif, plan a 1kg/semaine sur 4 semaines.
    // Avec ces valeurs precises, TDEE - 1100 (1335.8) tombe sous le BMR
    // (1571.5) : le plancher de securite s'applique (voir le test dedie
    // ci-dessous), donc ce cas-ci verifie la formule sans plancher via un
    // niveau d'activite plus eleve (Athlete) qui laisse assez de marge.
    const bmr = calculateBmr({
      sexe: 'femme',
      poidsKg: 82,
      tailleCm: 170,
      age: 30,
    });
    const result = calculateCalorieBudget({
      bmr,
      niveauActivite: 'athlete',
      rythmeKgParSemaine: -1,
    });
    expect(result.tdee).toBeCloseTo(bmr * 1.725, 5);
    // deficit = 7700/7 ~= 1100 kcal/j
    expect(result.tdee - result.budget).toBeCloseTo(1100, 0);
    expect(result.budgetPlafonneAuBmr).toBe(false);
  });

  it("plafonne au BMR le cas nominal de l'AC avec un niveau Sportif (le calcul brut tombe sous le BMR)", () => {
    // Memes valeurs que l'exemple de l'AC (user-stories.md) : le detail du
    // calcul y est correct (TDEE = BMR x 1.55, deficit ~= 1100 kcal/j) mais
    // le resultat brut (TDEE - 1100 = 1335.8) est sous le BMR (1571.5) : le
    // plancher de securite explicite de l'AC s'applique.
    const bmr = calculateBmr({
      sexe: 'femme',
      poidsKg: 82,
      tailleCm: 170,
      age: 30,
    });
    const result = calculateCalorieBudget({
      bmr,
      niveauActivite: 'sportif',
      rythmeKgParSemaine: -1,
    });
    expect(result.budget).toBeCloseTo(bmr, 5);
    expect(result.budgetPlafonneAuBmr).toBe(true);
  });

  it('suggere un surplus derive du rythme de prise de masse', () => {
    const bmr = 1500;
    const result = calculateCalorieBudget({
      bmr,
      niveauActivite: 'sedentaire',
      rythmeKgParSemaine: 0.5,
    });
    // surplus = 0.5 * 7700 / 7 ~= 550 kcal/j
    expect(result.budget - result.tdee).toBeCloseTo(550, 0);
  });

  it('plafonne le budget suggere au BMR si le calcul descend en dessous', () => {
    const bmr = 1400;
    const result = calculateCalorieBudget({
      bmr,
      niveauActivite: 'sedentaire', // TDEE faible
      rythmeKgParSemaine: -1, // deficit proche du maximum autorise
    });
    expect(result.budget).toBe(bmr);
    expect(result.budgetPlafonneAuBmr).toBe(true);
  });

  it('retient la valeur du coach plutot que la suggestion, sans la plafonner', () => {
    const bmr = 1400;
    const result = calculateCalorieBudget({
      bmr,
      niveauActivite: 'sedentaire',
      rythmeKgParSemaine: -1,
      coachOverride: 1200, // sous le BMR, choix explicite du coach
    });
    expect(result.budget).toBe(1200);
    expect(result.budgetPlafonneAuBmr).toBe(false);
  });
});
