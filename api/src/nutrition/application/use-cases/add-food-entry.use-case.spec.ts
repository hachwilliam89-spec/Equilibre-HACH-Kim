import { randomUUID } from 'node:crypto';
import { AppException } from '../../../common/errors/app-exception';
import { Food } from '../../../foods/domain/entities/food.entity';
import type { FoodRepositoryPort } from '../../../foods/domain/ports/food-repository.port';
import { Plan } from '../../../plans/domain/entities/plan.entity';
import type { PlanRepositoryPort } from '../../../plans/domain/ports/plan-repository.port';
import { Suivi } from '../../../suivis/domain/entities/suivi.entity';
import type { SuiviRepositoryPort } from '../../../suivis/domain/ports/suivi-repository.port';
import { AddFoodEntryUseCase } from './add-food-entry.use-case';

const userId = 'user-1';
const food = Food.create({
  id: randomUUID(),
  nom: 'Pomme',
  categorie: 'fruits',
  caloriesKcalPour100g: 52,
  proteinesGPour100g: 0.3,
  glucidesGPour100g: 14,
  lipidesGPour100g: 0.2,
});

function plan(dateDebut = new Date('2026-01-01T00:00:00Z')): Plan {
  return Plan.restore({
    id: 'plan-1',
    userId,
    coachId: 'coach-1',
    poidsDepart: 80,
    poidsCible: 75,
    dateDebut,
    dateCible: new Date('2099-12-31T00:00:00Z'),
    imcCible: 24,
    niveauActivite: 'actif',
    budgetCalorique: 1800,
    budgetPlafonneAuBmr: false,
    statut: 'actif',
    createdAt: dateDebut,
  });
}

/** Dépôt en mémoire : conserve l'agrégat et applique le verrou de version. */
function setup(planActif = plan()) {
  let stored = Suivi.create(userId);
  stored.activerPlan(planActif);
  const suivis = {
    charger: jest.fn(() => Promise.resolve(Suivi.restore(stored.toProps()))),
    sauvegarderSiVersion: jest.fn((suivi: Suivi, version: number) => {
      if (stored.toProps().version !== version) return Promise.resolve(false);
      stored = Suivi.restore({ ...suivi.toProps(), version: version + 1 });
      return Promise.resolve(true);
    }),
  } as unknown as SuiviRepositoryPort;
  const plans = {
    findActiveByUserId: jest.fn().mockResolvedValue(planActif),
  } as unknown as PlanRepositoryPort;
  const foods = {
    findById: jest.fn((id: string) =>
      Promise.resolve(id === food.toProps().id ? food : null),
    ),
  } as unknown as FoodRepositoryPort;
  return {
    useCase: new AddFoodEntryUseCase(plans, foods, suivis),
    journaux: () => stored.toProps().journauxAlimentaires,
  };
}

describe('AddFoodEntryUseCase.executeDepuisSynchro', () => {
  const hierSoir = () => {
    const date = new Date(Date.now() - 86_400_000);
    date.setUTCHours(20, 0, 0, 0);
    return date;
  };

  it('range une entrée saisie hors ligne dans le journal de son jour de consommation', async () => {
    const { useCase, journaux } = setup();
    const consommeLe = hierSoir();

    const { journal, dejaAppliquee } = await useCase.executeDepuisSynchro(
      userId,
      {
        entreeId: randomUUID(),
        foodId: food.toProps().id,
        quantiteGrammes: 150,
        categorieRepas: 'diner',
        consommeLe,
      },
    );

    expect(dejaAppliquee).toBe(false);
    expect(journal.toProps().jourUtc).toBe(
      consommeLe.toISOString().slice(0, 10),
    );
    expect(journaux()).toHaveLength(1);
    expect(journal.toProps().totalCaloriesKcal).toBe(78);
  });

  it('est idempotent : rejouer la même entrée ne la duplique pas', async () => {
    const { useCase, journaux } = setup();
    const entree = {
      entreeId: randomUUID(),
      foodId: food.toProps().id,
      quantiteGrammes: 100,
      consommeLe: new Date(),
    };

    await useCase.executeDepuisSynchro(userId, entree);
    const rejeu = await useCase.executeDepuisSynchro(userId, entree);

    expect(rejeu.dejaAppliquee).toBe(true);
    expect(journaux()[0].toProps().entrees).toHaveLength(1);
  });

  it('refuse une entrée plus ancienne que la fenêtre de synchronisation', async () => {
    const { useCase, journaux } = setup();

    await expect(
      useCase.executeDepuisSynchro(userId, {
        entreeId: randomUUID(),
        foodId: food.toProps().id,
        quantiteGrammes: 100,
        consommeLe: new Date(Date.now() - 10 * 86_400_000),
      }),
    ).rejects.toBeInstanceOf(AppException);
    expect(journaux()).toHaveLength(0);
  });

  it('refuse une entrée datée avant le début du plan actif', async () => {
    const { useCase } = setup(plan(new Date()));

    await expect(
      useCase.executeDepuisSynchro(userId, {
        entreeId: randomUUID(),
        foodId: food.toProps().id,
        quantiteGrammes: 100,
        consommeLe: hierSoir(),
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
