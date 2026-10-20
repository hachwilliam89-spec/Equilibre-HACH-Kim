import type { MeasurementProps } from '../../../measurements/domain/entities/measurement.entity';
import type { PlanProps } from '../../../plans/domain/entities/plan.entity';
import {
  alertePersistante,
  pointsCalories,
  pointsPoids,
  type JourneeAlimentaire,
  type PointSuivi,
} from './ecart-persistant';

// Trajectoire plate (80 → 80 impossible) : 80 → 70 kg sur 100 jours,
// soit 0,1 kg de moins par jour à partir du 1er octobre.
const plan: PlanProps = {
  id: 'plan-1',
  userId: 'user-1',
  coachId: 'coach-1',
  poidsDepart: 80,
  poidsCible: 70,
  dateDebut: new Date('2026-10-01T00:00:00Z'),
  dateCible: new Date('2027-01-09T00:00:00Z'),
  imcCible: 24,
  niveauActivite: 'actif',
  budgetCalorique: 1800,
  budgetPlafonneAuBmr: false,
  statut: 'actif',
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

const point = (jourUtc: string, horsTolerance: boolean): PointSuivi => ({
  jourUtc,
  ecart: horsTolerance ? 2 : 0,
  horsTolerance,
});

function mesure(
  jour: number,
  poidsKg: number,
  statut: MeasurementProps['statut'] = 'valide',
): MeasurementProps {
  const jourUtc = `2026-10-${String(jour).padStart(2, '0')}`;
  return {
    id: `m-${jour}-${statut}`,
    userId: 'user-1',
    planId: plan.id,
    poidsKg,
    receivedAt: new Date(`${jourUtc}T07:00:00Z`),
    jourUtc,
    source: 'automatique',
    statut,
  };
}

/** Poids attendu le jour j d'octobre : 80 − 0,1 × (j − 1). */
const attendu = (jour: number) => 80 - 0.1 * (jour - 1);

describe('écart persistant (US5)', () => {
  describe('règle commune', () => {
    it('alerte après 3 valeurs consécutives hors tolérance', () => {
      const alerte = alertePersistante('poids', [
        point('2026-10-01', false),
        point('2026-10-02', true),
        point('2026-10-03', true),
        point('2026-10-04', true),
      ]);
      expect(alerte).toEqual({
        metrique: 'poids',
        serie: 3,
        depuis: '2026-10-02',
        derniere: point('2026-10-04', true),
      });
    });

    it('n’alerte pas sur 2 écarts, ni quand une valeur dans la tolérance interrompt la série', () => {
      expect(
        alertePersistante('poids', [
          point('2026-10-01', true),
          point('2026-10-02', true),
        ]),
      ).toBeNull();
      expect(
        alertePersistante('calories', [
          point('2026-10-01', true),
          point('2026-10-02', true),
          point('2026-10-03', false),
        ]),
      ).toBeNull();
    });

    it('fait disparaître l’alerte dès le retour dans la tolérance', () => {
      const points = [1, 2, 3].map((j) => point(`2026-10-0${j}`, true));
      expect(alertePersistante('poids', points)).not.toBeNull();
      expect(
        alertePersistante('poids', [...points, point('2026-10-04', false)]),
      ).toBeNull();
    });
  });

  describe('poids', () => {
    it('compte les pesées valides à plus de 1 kg de la trajectoire', () => {
      const points = pointsPoids(plan, [
        mesure(2, attendu(2) + 1.5),
        mesure(3, attendu(3) + 1),
        mesure(4, attendu(4) - 1.2),
      ]);
      expect(points.map((p) => p.horsTolerance)).toEqual([true, false, true]);
    });

    it('ignore une mesure suspecte au milieu de la série : alerte à la 3e valeur valide', () => {
      const points = pointsPoids(plan, [
        mesure(2, attendu(2) + 1.5),
        mesure(3, attendu(3) + 1.6),
        mesure(4, attendu(4) - 4, 'suspecte'),
        mesure(5, attendu(5) + 1.4),
      ]);
      expect(points).toHaveLength(3);
      expect(alertePersistante('poids', points)?.serie).toBe(3);
    });

    it('repart de zéro après un ajustement de l’objectif', () => {
      const mesures = [2, 3, 4].map((j) => mesure(j, attendu(j) + 2));
      expect(
        alertePersistante('poids', pointsPoids(plan, mesures)),
      ).not.toBeNull();
      const ajuste = {
        ...plan,
        poidsAjusteLe: new Date('2026-10-04T12:00:00Z'),
      };
      expect(pointsPoids(ajuste, mesures)).toEqual([]);
    });
  });

  describe('calories', () => {
    const journee = (
      jour: number,
      total: number,
      nombreEntrees = 2,
    ): JourneeAlimentaire => ({
      planId: plan.id,
      jourUtc: `2026-10-${String(jour).padStart(2, '0')}`,
      budgetCalorique: 1800,
      totalCaloriesKcal: total,
      nombreEntrees,
    });

    it('compte les journées clôturées au-delà de budget + 150 kcal', () => {
      const points = pointsCalories(
        plan,
        [
          journee(2, 1950),
          journee(3, 1951),
          journee(4, 2300),
          journee(5, 2400),
        ],
        '2026-10-05',
      );
      // Le 5 est la journée en cours : jamais évaluée avant sa clôture.
      expect(points.map((p) => [p.jourUtc, p.horsTolerance])).toEqual([
        ['2026-10-02', false],
        ['2026-10-03', true],
        ['2026-10-04', true],
      ]);
    });

    it('ignore les journées sans entrée et alerte après 3 dépassements', () => {
      const points = pointsCalories(
        plan,
        [
          journee(2, 2100),
          journee(3, 0, 0),
          journee(4, 2200),
          journee(5, 2050),
        ],
        '2026-10-06',
      );
      expect(alertePersistante('calories', points)).toMatchObject({
        serie: 3,
        depuis: '2026-10-02',
      });
    });

    it('repart de zéro après un ajustement du budget', () => {
      const journees = [2, 3, 4].map((j) => journee(j, 2300));
      const ajuste = {
        ...plan,
        budgetAjusteLe: new Date('2026-10-03T15:00:00Z'),
      };
      expect(
        pointsCalories(ajuste, journees, '2026-10-06').map((p) => p.jourUtc),
      ).toEqual(['2026-10-04']);
    });
  });

  it('suit les deux métriques indépendamment', () => {
    const poids = alertePersistante(
      'poids',
      pointsPoids(
        plan,
        [2, 3, 4].map((j) => mesure(j, attendu(j) + 2)),
      ),
    );
    const calories = alertePersistante('calories', [
      point('2026-10-02', true),
      point('2026-10-03', false),
    ]);
    expect(poids?.metrique).toBe('poids');
    expect(calories).toBeNull();
  });
});
