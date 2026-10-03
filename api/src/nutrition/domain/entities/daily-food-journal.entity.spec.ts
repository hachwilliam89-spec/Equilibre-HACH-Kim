import { randomUUID } from 'node:crypto';
import { Plan } from '../../../plans/domain/entities/plan.entity';
import { REFERENCE_FOODS } from '../../../foods/infrastructure/persistence/reference-foods';
import { DailyFoodJournal } from './daily-food-journal.entity';
import { FoodEntry } from './food-entry.entity';

const plan = () =>
  Plan.restore({
    id: randomUUID(),
    userId: randomUUID(),
    coachId: randomUUID(),
    poidsDepart: 80,
    poidsCible: 75,
    dateDebut: new Date('2026-01-01T00:00:00Z'),
    dateCible: new Date('2026-12-31T00:00:00Z'),
    imcCible: 24,
    niveauActivite: 'actif',
    budgetCalorique: 1800,
    budgetPlafonneAuBmr: false,
    statut: 'actif',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });

const entry = (
  foodIndex: number,
  quantity: number,
  receivedAt = new Date('2026-10-02T11:00:00Z'),
) =>
  FoodEntry.create({
    id: randomUUID(),
    aliment: REFERENCE_FOODS[foodIndex],
    quantiteGrammes: quantity,
    receivedAt,
  });

describe('Journal alimentaire quotidien', () => {
  it('fige les valeurs pour 100 g, calcule les quantités et recalcule le total après retrait', () => {
    const journal = DailyFoodJournal.create(
      plan(),
      new Date('2026-10-02T00:05:00Z'),
    );
    const rice = entry(0, 200);
    const pasta = entry(1, 100);
    journal.ajouterEntree(rice);
    journal.ajouterEntree(pasta);

    expect(rice.toProps()).toMatchObject({
      aliment: {
        nom: 'Riz blanc cuit',
        caloriesKcalPour100g: 130,
        proteinesGPour100g: 2.7,
        glucidesGPour100g: 28,
        lipidesGPour100g: 0.3,
      },
      caloriesKcal: 260,
      proteinesG: 5.4,
      glucidesG: 56,
      lipidesG: 0.6,
    });
    expect(journal.toProps()).toMatchObject({
      jourUtc: '2026-10-02',
      budgetCalorique: 1800,
      totalCaloriesKcal: 427,
      totalProteinesG: 11.5,
      totalGlucidesG: 87.4,
      totalLipidesG: 1.7,
    });

    expect(journal.retirerEntree(rice.toProps().id)).toBe(true);
    expect(journal.toProps()).toMatchObject({
      totalCaloriesKcal: 167,
      totalProteinesG: 6.1,
      totalGlucidesG: 31.4,
      totalLipidesG: 1.1,
    });
    expect(journal.retirerEntree(rice.toProps().id)).toBe(false);
  });

  it('refuse une entrée reçue un autre jour UTC', () => {
    const journal = DailyFoodJournal.create(
      plan(),
      new Date('2026-10-02T00:05:00Z'),
    );
    expect(() =>
      journal.ajouterEntree(entry(0, 100, new Date('2026-10-01T23:59:59Z'))),
    ).toThrow('jour UTC');
    expect(journal.toProps().entrees).toHaveLength(0);
  });
});
