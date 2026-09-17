import { Plan, PlanCreateProps } from './plan.entity';

const baseProps: PlanCreateProps = {
  id: 'plan-id',
  userId: 'user-id',
  coachId: 'coach-id',
  poidsDepart: 82,
  poidsCible: 78, // -4kg sur 4 semaines = -1kg/semaine (limite)
  dateDebut: new Date('2026-01-01'),
  dateCible: new Date('2026-01-29'), // 4 semaines
  tailleCm: 170,
  niveauActivite: 'sedentaire',
  budgetCalorique: 1500,
  budgetPlafonneAuBmr: false,
  createdAt: new Date('2026-01-01'),
};

describe('Plan (entite domaine)', () => {
  it('reste actif pendant toute la date cible UTC et expire le lendemain', () => {
    const plan = Plan.create(baseProps);
    expect(plan.hasExpired(new Date('2026-01-29T23:59:59.999Z'))).toBe(false);
    expect(plan.hasExpired(new Date('2026-01-30T00:00:00.000Z'))).toBe(true);
  });
  it('cree un plan valide (cas nominal)', () => {
    const plan = Plan.create(baseProps);
    expect(plan.statut).toBe('actif');
  });

  it('refuse une date cible anterieure a la date de debut', () => {
    expect(() =>
      Plan.create({
        ...baseProps,
        dateDebut: new Date('2026-01-10'),
        dateCible: new Date('2026-01-01'),
      }),
    ).toThrow('La date cible doit être strictement postérieure');
  });

  it('refuse une date cible egale a la date de debut', () => {
    expect(() =>
      Plan.create({
        ...baseProps,
        dateDebut: new Date('2026-01-01'),
        dateCible: new Date('2026-01-01'),
      }),
    ).toThrow('La date cible doit être strictement postérieure');
  });

  it('refuse un poids cible egal au poids de depart', () => {
    expect(() =>
      Plan.create({ ...baseProps, poidsCible: baseProps.poidsDepart }),
    ).toThrow('Le poids cible doit être différent du poids de départ');
  });

  it('refuse un IMC cible sous le seuil de denutrition', () => {
    expect(() =>
      Plan.create({
        ...baseProps,
        poidsCible: 45, // IMC ~= 15.6 pour 1.70m
        dateCible: new Date('2026-06-01'), // duree longue pour rester dans un rythme sain
      }),
    ).toThrow('dénutrition');
  });

  it('accepte un IMC cible pile a 18.5 (borne incluse)', () => {
    const plan = Plan.create({
      ...baseProps,
      tailleCm: 200,
      poidsDepart: 75,
      poidsCible: 74, // 74 / 2² = 18.5 exactement
      dateCible: new Date('2026-03-01'), // rythme sous 1kg/semaine
    });
    expect(plan.statut).toBe('actif');
  });

  it('accepte un IMC cible eleve (>30) tant que le rythme reste sain', () => {
    const plan = Plan.create({
      ...baseProps,
      poidsDepart: 101,
      poidsCible: 93, // IMC ~= 32.2 pour 1.70m
      dateDebut: new Date('2026-01-01'),
      dateCible: new Date('2026-02-26'), // 8 semaines, 1kg/semaine
    });
    expect(plan.statut).toBe('actif');
  });

  it('refuse un rythme de perte trop rapide', () => {
    expect(() =>
      Plan.create({
        ...baseProps,
        poidsDepart: 82,
        poidsCible: 74, // 2kg/semaine sur 4 semaines
      }),
    ).toThrow('Rythme de perte trop rapide');
  });

  it('accepte un rythme de perte pile a la limite (1kg/semaine)', () => {
    const plan = Plan.create({ ...baseProps }); // baseProps = -1kg/semaine exactement
    expect(plan.statut).toBe('actif');
  });

  it('refuse un rythme de prise de masse trop rapide', () => {
    expect(() =>
      Plan.create({
        ...baseProps,
        poidsDepart: 70,
        poidsCible: 74, // 1kg/semaine sur 4 semaines, > 0.5 autorise
      }),
    ).toThrow('Rythme de prise de masse trop rapide');
  });

  it('accepte un rythme de prise de masse pile a la limite (0.5kg/semaine)', () => {
    const plan = Plan.create({
      ...baseProps,
      poidsDepart: 70,
      poidsCible: 72, // 0.5kg/semaine sur 4 semaines
    });
    expect(plan.statut).toBe('actif');
  });

  describe('cycle de vie', () => {
    it('passe automatiquement a termine quand la date cible est depassee', () => {
      const plan = Plan.create(baseProps);
      expect(plan.hasExpired(new Date('2026-02-01'))).toBe(true);
      plan.terminate();
      expect(plan.statut).toBe('termine');
    });

    it("ne detecte pas d'expiration avant la date cible", () => {
      const plan = Plan.create(baseProps);
      expect(plan.hasExpired(new Date('2026-01-15'))).toBe(false);
    });

    it('peut etre annule manuellement depuis le statut actif', () => {
      const plan = Plan.create(baseProps);
      plan.cancel();
      expect(plan.statut).toBe('annule');
    });

    it("refuse d'annuler un plan qui n'est plus actif", () => {
      const plan = Plan.create(baseProps);
      plan.terminate();
      expect(() => plan.cancel()).toThrow(
        'Seul un plan actif peut être annulé',
      );
    });
  });
});
