import { DailyFoodJournal } from '../../../nutrition/domain/entities/daily-food-journal.entity';
import { FoodEntry } from '../../../nutrition/domain/entities/food-entry.entity';
import { Plan } from '../../../plans/domain/entities/plan.entity';
import { MAX_ENTREES_RETIREES, Suivi } from './suivi.entity';

const maintenant = new Date('2026-10-16T12:00:00Z');
const plan = Plan.restore({
  id: 'plan-1',
  userId: 'user-1',
  coachId: 'coach-1',
  poidsDepart: 80,
  poidsCible: 76,
  dateDebut: new Date('2026-10-01T00:00:00Z'),
  dateCible: new Date('2026-12-31T00:00:00Z'),
  imcCible: 24,
  niveauActivite: 'actif',
  budgetCalorique: 1800,
  budgetPlafonneAuBmr: false,
  statut: 'actif',
  createdAt: new Date('2026-10-01T00:00:00Z'),
});

function suiviAvecEntree(id: string, receivedAt = maintenant): Suivi {
  const suivi = Suivi.create('user-1');
  suivi.activerPlan(plan);
  const journal = DailyFoodJournal.create(plan, receivedAt);
  journal.ajouterEntree(
    FoodEntry.create({
      id,
      aliment: {
        id: 'food-1',
        nom: 'Pomme',
        nomNormalise: 'pomme',
        categorie: 'fruits',
        caloriesKcalPour100g: 52,
        proteinesGPour100g: 0.3,
        glucidesGPour100g: 14,
        lipidesGPour100g: 0.2,
      },
      quantiteGrammes: 100,
      receivedAt,
    }),
  );
  suivi.ajouterJournalAlimentaire(journal, receivedAt);
  return suivi;
}

describe('Suivi : traces des entrees retirees', () => {
  it('retire l entree et garde la trace de son retrait', () => {
    const suivi = suiviAvecEntree('entree-1');

    const journal = suivi.retirerEntreeAlimentaire('entree-1', maintenant);

    expect(journal?.toProps().entrees).toHaveLength(0);
    expect(suivi.entreeAlimentaireRetiree('entree-1')).toBe(true);
    expect(suivi.toProps().entreesRetirees).toEqual([
      { id: 'entree-1', consommeLe: maintenant, retireeLe: maintenant },
    ]);
  });

  it('renvoie null pour une entree inconnue, sans trace', () => {
    const suivi = suiviAvecEntree('entree-1');

    expect(suivi.retirerEntreeAlimentaire('inconnue', maintenant)).toBeNull();
    expect(suivi.toProps().entreesRetirees).toEqual([]);
  });

  it('purge les traces dont l ajout ne peut plus etre rejoue (fenetre de 7 jours + 1)', () => {
    const suivi = Suivi.restore({
      ...suiviAvecEntree('entree-1').toProps(),
      entreesRetirees: [
        {
          id: 'ancienne',
          consommeLe: new Date('2026-10-07T11:00:00Z'),
          retireeLe: new Date('2026-10-07T12:00:00Z'),
        },
        {
          id: 'recente',
          consommeLe: new Date('2026-10-09T13:00:00Z'),
          retireeLe: new Date('2026-10-09T14:00:00Z'),
        },
      ],
    });

    suivi.retirerEntreeAlimentaire('entree-1', maintenant);

    expect(suivi.toProps().entreesRetirees.map((trace) => trace.id)).toEqual([
      'recente',
      'entree-1',
    ]);
  });

  it('borne le nombre de traces', () => {
    const traces = Array.from({ length: MAX_ENTREES_RETIREES }, (_, i) => ({
      id: `trace-${i}`,
      consommeLe: maintenant,
      retireeLe: maintenant,
    }));
    const suivi = Suivi.restore({
      ...suiviAvecEntree('entree-1').toProps(),
      entreesRetirees: traces,
    });

    suivi.retirerEntreeAlimentaire('entree-1', maintenant);

    const ids = suivi.toProps().entreesRetirees.map((trace) => trace.id);
    expect(ids).toHaveLength(MAX_ENTREES_RETIREES);
    expect(ids[0]).toBe('trace-1');
    expect(ids.at(-1)).toBe('entree-1');
  });

  it('restaure un ancien document sans traces', () => {
    const ancien: Partial<ReturnType<Suivi['toProps']>> =
      suiviAvecEntree('entree-1').toProps();
    delete ancien.entreesRetirees;

    expect(
      Suivi.restore(ancien as Parameters<typeof Suivi.restore>[0]).toProps()
        .entreesRetirees,
    ).toEqual([]);
  });
});
