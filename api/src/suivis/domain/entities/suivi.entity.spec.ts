import { randomUUID } from 'node:crypto';
import { Measurement } from '../../../measurements/domain/entities/measurement.entity';
import { Plan } from '../../../plans/domain/entities/plan.entity';
import { MAX_MESURES_SUIVI, Suivi, troisMoisAvantUtc } from './suivi.entity';

const userId = randomUUID();
const plan = () =>
  Plan.restore({
    id: randomUUID(),
    userId,
    coachId: randomUUID(),
    poidsDepart: 80,
    poidsCible: 75,
    dateDebut: new Date('2026-01-01T00:00:00Z'),
    dateCible: new Date('2026-12-31T00:00:00Z'),
    imcCible: 24,
    niveauActivite: 'actif',
    budgetCalorique: 2000,
    budgetPlafonneAuBmr: false,
    statut: 'actif',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });

const measurement = (
  planId: string,
  overrides: Partial<Parameters<typeof Measurement.create>[0]> = {},
) =>
  Measurement.create({
    id: randomUUID(),
    userId,
    planId,
    poidsKg: 75,
    receivedAt: new Date('2026-09-30T10:00:00Z'),
    source: 'automatique',
    statut: 'valide',
    ...overrides,
  });

describe('Suivi — agrégat documentaire', () => {
  it('ajoute atomiquement une mesure valide et son blocage journalier', () => {
    const suivi = Suivi.create(userId);
    const active = plan();
    suivi.activerPlan(active);
    const value = measurement(active.id);
    suivi.ajouterMesure(value);
    expect(suivi.toProps()).toMatchObject({
      mesures: [value],
      derniereMesureValide: value,
      blocageJournalier: {
        jourUtc: '2026-09-30',
        mesureId: value.toProps().id,
      },
    });
  });

  it('une correction manuelle hors-plan bloque aussi la journée', () => {
    const suivi = Suivi.create(userId);
    const active = plan();
    suivi.activerPlan(active);
    suivi.ajouterMesure(
      measurement(active.id, { source: 'manuelle', statut: 'hors-plan' }),
    );
    expect(() =>
      suivi.ajouterMesure(
        measurement(active.id, { statut: 'suspecte', source: 'manuelle' }),
      ),
    ).toThrow();
    try {
      suivi.ajouterMesure(
        measurement(active.id, { statut: 'suspecte', source: 'manuelle' }),
      );
    } catch (error) {
      expect(error).toMatchObject({ status: 409 });
    }
  });

  it('purge trois mois calendaires avec la journée limite incluse', () => {
    const active = plan();
    const suivi = Suivi.restore({
      userId,
      version: 1,
      planActif: active,
      plans: [],
      mesures: [
        measurement(active.id, {
          receivedAt: new Date('2026-02-28T01:00:00Z'),
          statut: 'suspecte',
        }),
        measurement(active.id, {
          receivedAt: new Date('2026-02-27T23:59:59Z'),
          statut: 'suspecte',
        }),
      ],
      derniereMesureValide: null,
      blocageJournalier: null,
    });
    suivi.purgerHistorique(new Date('2026-05-31T12:00:00Z'));
    expect(suivi.toProps().mesures).toHaveLength(1);
    expect(troisMoisAvantUtc(new Date('2026-05-31T12:00:00Z'))).toEqual(
      new Date('2026-02-28T00:00:00Z'),
    );
  });

  it('refuse la 1001e mesure récente avec 429 sans modifier le suivi', () => {
    const active = plan();
    const mesures = Array.from({ length: MAX_MESURES_SUIVI }, (_, index) =>
      measurement(active.id, {
        receivedAt: new Date(
          `2026-09-${String((index % 29) + 1).padStart(2, '0')}T10:00:00Z`,
        ),
        statut: 'suspecte',
      }),
    );
    const suivi = Suivi.restore({
      userId,
      version: 4,
      planActif: active,
      plans: [],
      mesures,
      derniereMesureValide: null,
      blocageJournalier: null,
    });
    expect(() =>
      suivi.ajouterMesure(
        measurement(active.id, {
          receivedAt: new Date('2026-09-30T10:00:00Z'),
          statut: 'suspecte',
        }),
      ),
    ).toThrow();
    try {
      suivi.ajouterMesure(
        measurement(active.id, {
          receivedAt: new Date('2026-09-30T10:00:00Z'),
          statut: 'suspecte',
        }),
      );
    } catch (error) {
      expect(error).toMatchObject({ status: 429 });
    }
    expect(suivi.toProps().mesures).toHaveLength(MAX_MESURES_SUIVI);
  });
});
