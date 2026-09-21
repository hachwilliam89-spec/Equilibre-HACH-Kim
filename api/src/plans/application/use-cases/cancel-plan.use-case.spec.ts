import { HttpStatus } from '@nestjs/common';
import { CancelPlanUseCase } from './cancel-plan.use-case';
import { Plan, PlanCreateProps } from '../../domain/entities/plan.entity';
import { User, UserProps } from '../../../auth/domain/entities/user.entity';
import { AppException } from '../../../common/errors/app-exception';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';

// Dates dans le futur lointain : le plan n'expire jamais pendant les tests,
// quelle que soit la date d'execution reelle.
const basePlanProps: PlanCreateProps = {
  id: 'plan-id',
  userId: 'user-id',
  coachId: 'coach-id',
  poidsDepart: 82,
  poidsCible: 78, // -1kg/semaine sur 4 semaines, a la limite (valide)
  dateDebut: new Date('2099-01-01'),
  dateCible: new Date('2099-01-29'),
  tailleCm: 170,
  niveauActivite: 'sedentaire',
  budgetCalorique: 1500,
  budgetPlafonneAuBmr: false,
  createdAt: new Date('2099-01-01'),
};

function buildActivePlan(overrides: Partial<PlanCreateProps> = {}): Plan {
  return Plan.create({ ...basePlanProps, ...overrides });
}

function buildUser(overrides: Partial<UserProps> = {}): User {
  return User.create({
    id: 'user-id',
    email: 'user@example.com',
    passwordHash: 'hash',
    role: 'utilisateur',
    coachId: 'coach-id',
    tailleCm: 170,
    age: 30,
    sexe: 'femme',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  });
}

function buildRepos() {
  const planRepository: jest.Mocked<PlanRepositoryPort> = {
    create: jest.fn(),
    findById: jest.fn(),
    findActiveByUserId: jest.fn(),
    save: jest.fn(),
  };
  const userRepository: jest.Mocked<UserRepositoryPort> = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  return { planRepository, userRepository };
}

async function expectAppException(
  promise: Promise<unknown>,
  status: HttpStatus,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AppException);
  expect((caught as AppException).getStatus()).toBe(status);
}

describe('CancelPlanUseCase', () => {
  it('annule un plan actif rattache au coach (cas nominal)', async () => {
    const { planRepository, userRepository } = buildRepos();
    const plan = buildActivePlan();
    planRepository.findById.mockResolvedValue(plan);
    userRepository.findById.mockResolvedValue(buildUser());
    planRepository.save.mockImplementation((p) => Promise.resolve(p));

    const useCase = new CancelPlanUseCase(planRepository, userRepository);
    const result = await useCase.execute({
      coachId: 'coach-id',
      planId: 'plan-id',
    });

    expect(result.statut).toBe('annule');
    expect(planRepository.save).toHaveBeenCalledWith(plan);
  });

  it("leve plan-not-found (404) si le plan n'existe pas", async () => {
    const { planRepository, userRepository } = buildRepos();
    planRepository.findById.mockResolvedValue(null);

    const useCase = new CancelPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({ coachId: 'coach-id', planId: 'inconnu' }),
      HttpStatus.NOT_FOUND,
    );
  });

  it("leve forbidden (403) si le plan n'est pas rattache a ce coach", async () => {
    const { planRepository, userRepository } = buildRepos();
    planRepository.findById.mockResolvedValue(buildActivePlan());
    userRepository.findById.mockResolvedValue(
      buildUser({ coachId: 'autre-coach' }),
    );

    const useCase = new CancelPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({ coachId: 'coach-id', planId: 'plan-id' }),
      HttpStatus.FORBIDDEN,
    );
  });

  it("leve forbidden (403) si l'utilisateur du plan est introuvable", async () => {
    const { planRepository, userRepository } = buildRepos();
    planRepository.findById.mockResolvedValue(buildActivePlan());
    userRepository.findById.mockResolvedValue(null);

    const useCase = new CancelPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({ coachId: 'coach-id', planId: 'plan-id' }),
      HttpStatus.FORBIDDEN,
    );
  });

  it('leve plan-not-active (409) si le plan actif est deja expire', async () => {
    const { planRepository, userRepository } = buildRepos();
    const planExpire = buildActivePlan({
      dateDebut: new Date('2020-01-01'),
      dateCible: new Date('2020-01-29'),
    });
    planRepository.findById.mockResolvedValue(planExpire);
    userRepository.findById.mockResolvedValue(buildUser());
    planRepository.findActiveByUserId.mockResolvedValue(null);

    const useCase = new CancelPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({ coachId: 'coach-id', planId: 'plan-id' }),
      HttpStatus.CONFLICT,
    );
  });

  it("leve plan-not-active (409) si le plan n'est deja plus actif", async () => {
    const { planRepository, userRepository } = buildRepos();
    const plan = buildActivePlan();
    plan.cancel(); // statut = 'annule'
    planRepository.findById.mockResolvedValue(plan);
    userRepository.findById.mockResolvedValue(buildUser());

    const useCase = new CancelPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({ coachId: 'coach-id', planId: 'plan-id' }),
      HttpStatus.CONFLICT,
    );
  });
});
