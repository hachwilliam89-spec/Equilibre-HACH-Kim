import { HttpStatus } from '@nestjs/common';
import {
  User,
  type UserProps,
} from '../../../auth/domain/entities/user.entity';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';
import { AppException } from '../../../common/errors/app-exception';
import type { GetMeasurementHistoryUseCase } from '../../../measurements/application/use-cases/get-measurement-history.use-case';
import type { GetWeightTrackingStatusUseCase } from '../../../measurements/application/use-cases/get-weight-tracking-status.use-case';
import type { GetFoodBudgetStatusUseCase } from '../../../nutrition/application/use-cases/get-food-budget-status.use-case';
import { DailyFoodJournal } from '../../../nutrition/domain/entities/daily-food-journal.entity';
import { FoodEntry } from '../../../nutrition/domain/entities/food-entry.entity';
import { Plan } from '../../../plans/domain/entities/plan.entity';
import { Suivi } from '../../../suivis/domain/entities/suivi.entity';
import type { SuiviRepositoryPort } from '../../../suivis/domain/ports/suivi-repository.port';
import { GetClientProgressionUseCase } from './get-client-progression.use-case';

const plan = Plan.restore({
  id: 'plan-1',
  userId: 'user-1',
  coachId: 'coach-1',
  poidsDepart: 80,
  poidsCible: 75,
  dateDebut: new Date('2026-10-01T00:00:00Z'),
  dateCible: new Date('2026-12-31T00:00:00Z'),
  imcCible: 24,
  niveauActivite: 'actif',
  budgetCalorique: 1800,
  budgetPlafonneAuBmr: false,
  statut: 'actif',
  createdAt: new Date('2026-10-01T00:00:00Z'),
});

const user = (overrides: Partial<UserProps> = {}) =>
  User.create({
    id: 'user-1',
    email: 'user1@example.test',
    passwordHash: 'hash',
    role: 'utilisateur',
    coachId: 'coach-1',
    tailleCm: 175,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  });

function journal(jourUtc: string, quantiteGrammes: number, planId = plan.id) {
  const j = DailyFoodJournal.restore({
    planId,
    jourUtc,
    budgetCalorique: 1800,
    entrees: [],
    totalCaloriesKcal: 0,
    totalProteinesG: 0,
    totalGlucidesG: 0,
    totalLipidesG: 0,
  });
  j.ajouterEntree(
    FoodEntry.restore({
      id: `e-${jourUtc}-${planId}`,
      aliment: {
        id: 'riz',
        nom: 'Riz blanc cuit',
        caloriesKcalPour100g: 130,
        proteinesGPour100g: 2.7,
        glucidesGPour100g: 28,
        lipidesGPour100g: 0.3,
      },
      quantiteGrammes,
      caloriesKcal: quantiteGrammes * 1.3,
      proteinesG: quantiteGrammes * 0.027,
      glucidesG: quantiteGrammes * 0.28,
      lipidesG: quantiteGrammes * 0.003,
      categorieRepas: 'dejeuner',
      receivedAt: new Date(`${jourUtc}T12:00:00Z`),
    }),
  );
  return j;
}

function build(found: User | null) {
  const users = {
    findById: jest.fn().mockResolvedValue(found),
  } as unknown as UserRepositoryPort;
  const suivi = Suivi.restore({
    userId: 'user-1',
    version: 1,
    planActif: plan,
    plans: [plan],
    mesures: [],
    derniereMesureValide: null,
    blocageJournalier: null,
    journauxAlimentaires: [
      journal('2026-10-07', 200),
      journal('2026-10-08', 1500),
      journal('2026-10-08', 100, 'ancien-plan'),
    ],
  });
  const suivis = {
    charger: jest.fn().mockResolvedValue(suivi),
  } as unknown as SuiviRepositoryPort;
  const weightExecute = jest.fn().mockResolvedValue({
    statut: 'dans-les-clous',
    plan,
    derniereMesure: null,
    ecart: null,
  });
  const weight = {
    execute: weightExecute,
  } as unknown as GetWeightTrackingStatusUseCase;
  const food = {
    execute: jest.fn().mockResolvedValue({
      statut: 'depassement',
      ecartKcal: 150,
      budgetCalorique: 1800,
      ciblesMacros: { proteinesG: 150, glucidesG: 180, lipidesG: 50 },
      journal: null,
    }),
  } as unknown as GetFoodBudgetStatusUseCase;
  const history = {
    execute: jest.fn().mockResolvedValue([]),
  } as unknown as GetMeasurementHistoryUseCase;
  return {
    useCase: new GetClientProgressionUseCase(
      users,
      suivis,
      weight,
      food,
      history,
    ),
    weightExecute,
  };
}

async function expectForbidden(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) =>
    expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN),
  );
}

describe('GetClientProgressionUseCase', () => {
  it('refuse un utilisateur rattaché à un autre coach, inconnu ou coach', async () => {
    await expectForbidden(
      build(user({ coachId: 'coach-2' })).useCase.execute({
        coachId: 'coach-1',
        userId: 'user-1',
      }),
    );
    await expectForbidden(
      build(null).useCase.execute({ coachId: 'coach-1', userId: 'user-1' }),
    );
    const { useCase, weightExecute } = build(
      user({ role: 'coach', coachId: undefined }),
    );
    await expectForbidden(
      useCase.execute({ coachId: 'coach-1', userId: 'user-1' }),
    );
    expect(weightExecute).not.toHaveBeenCalled();
  });

  it('assemble 7 jours de totaux du plan actif, sans le détail des aliments', async () => {
    const result = await build(user()).useCase.execute({
      coachId: 'coach-1',
      userId: 'user-1',
      jourCourantUtc: '2026-10-08',
    });
    expect(result.alimentation?.jours).toHaveLength(7);
    expect(result.alimentation?.jours.slice(-2)).toEqual([
      expect.objectContaining({
        jourUtc: '2026-10-07',
        totalCaloriesKcal: 260,
        statut: 'dans-le-budget',
      }),
      expect.objectContaining({
        jourUtc: '2026-10-08',
        totalCaloriesKcal: 1950,
        nombreEntrees: 1,
        statut: 'dans-le-budget',
      }),
    ]);
    expect(JSON.stringify(result.alimentation)).not.toContain('Riz');
  });

  it('ne renvoie pas d’alimentation sans plan actif', async () => {
    const { useCase, weightExecute } = build(user());
    weightExecute.mockResolvedValue(null);
    const result = await useCase.execute({
      coachId: 'coach-1',
      userId: 'user-1',
    });
    expect(result.suiviPoids).toBeNull();
    expect(result.alimentation).toBeNull();
  });
});
