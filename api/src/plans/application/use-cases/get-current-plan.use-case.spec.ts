import { HttpStatus } from '@nestjs/common';
import { GetCurrentPlanUseCase } from './get-current-plan.use-case';
import { Plan, PlanCreateProps } from '../../domain/entities/plan.entity';
import { User, UserProps } from '../../../auth/domain/entities/user.entity';
import { AppException } from '../../../common/errors/app-exception';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';

const basePlanProps: PlanCreateProps = {
  id: 'plan-id',
  userId: 'user-id',
  coachId: 'coach-id',
  poidsDepart: 82,
  poidsCible: 78,
  dateDebut: new Date('2099-01-01'),
  dateCible: new Date('2099-01-29'),
  tailleCm: 170,
  niveauActivite: 'sedentaire',
  budgetCalorique: 1500,
  budgetPlafonneAuBmr: false,
  createdAt: new Date('2099-01-01'),
};

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

describe('GetCurrentPlanUseCase', () => {
  it('un utilisateur consulte son propre plan actif (cas nominal)', async () => {
    const { planRepository, userRepository } = buildRepos();
    const plan = Plan.create(basePlanProps);
    planRepository.findActiveByUserId.mockResolvedValue(plan);

    const useCase = new GetCurrentPlanUseCase(planRepository, userRepository);
    const result = await useCase.execute({
      requesterId: 'user-id',
      requesterRole: 'utilisateur',
      targetUserId: 'user-id',
    });

    expect(result).toBe(plan);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it("leve forbidden (403) si un utilisateur tente de consulter le plan d'un autre", async () => {
    const { planRepository, userRepository } = buildRepos();

    const useCase = new GetCurrentPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({
        requesterId: 'user-id',
        requesterRole: 'utilisateur',
        targetUserId: 'autre-user-id',
      }),
      HttpStatus.FORBIDDEN,
    );
    expect(planRepository.findActiveByUserId).not.toHaveBeenCalled();
  });

  it("un coach consulte le plan actif d'un utilisateur qui lui est rattache (cas nominal)", async () => {
    const { planRepository, userRepository } = buildRepos();
    const plan = Plan.create(basePlanProps);
    userRepository.findById.mockResolvedValue(buildUser());
    planRepository.findActiveByUserId.mockResolvedValue(plan);

    const useCase = new GetCurrentPlanUseCase(planRepository, userRepository);
    const result = await useCase.execute({
      requesterId: 'coach-id',
      requesterRole: 'coach',
      targetUserId: 'user-id',
    });

    expect(result).toBe(plan);
  });

  it("leve forbidden (403) si le coach n'est pas rattache a l'utilisateur cible", async () => {
    const { planRepository, userRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(
      buildUser({ coachId: 'autre-coach' }),
    );

    const useCase = new GetCurrentPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({
        requesterId: 'coach-id',
        requesterRole: 'coach',
        targetUserId: 'user-id',
      }),
      HttpStatus.FORBIDDEN,
    );
  });

  it("leve forbidden (403) si l'utilisateur cible est introuvable", async () => {
    const { planRepository, userRepository } = buildRepos();
    userRepository.findById.mockResolvedValue(null);

    const useCase = new GetCurrentPlanUseCase(planRepository, userRepository);
    await expectAppException(
      useCase.execute({
        requesterId: 'coach-id',
        requesterRole: 'coach',
        targetUserId: 'user-id',
      }),
      HttpStatus.FORBIDDEN,
    );
  });

  it("retourne null si l'utilisateur n'a aucun plan actif", async () => {
    const { planRepository, userRepository } = buildRepos();
    planRepository.findActiveByUserId.mockResolvedValue(null);

    const useCase = new GetCurrentPlanUseCase(planRepository, userRepository);
    const result = await useCase.execute({
      requesterId: 'user-id',
      requesterRole: 'utilisateur',
      targetUserId: 'user-id',
    });

    expect(result).toBeNull();
  });
});
