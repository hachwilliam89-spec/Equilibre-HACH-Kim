import { HttpStatus } from '@nestjs/common';
import { UpdatePlanUseCase } from './update-plan.use-case';
import { Plan, PlanCreateProps } from '../../domain/entities/plan.entity';
import { User, UserProps } from '../../../auth/domain/entities/user.entity';
import { AppException } from '../../../common/errors/app-exception';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';

// Dates lointaines : le plan n'expire pas pendant les tests.
const maintenant = new Date('2099-01-10T09:00:00Z');
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

function setup(
  plan: Plan | null = Plan.create(basePlanProps),
  user: User | null = buildUser(),
) {
  const planRepository: jest.Mocked<PlanRepositoryPort> = {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(plan),
    findActiveByUserId: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    updateActive: jest.fn((p: Plan) => Promise.resolve(p)),
  };
  const userRepository: jest.Mocked<UserRepositoryPort> = {
    findByCoachId: jest.fn(),
    findByCoachCode: jest.fn(),
    ensureCoachCode: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue(user),
    create: jest.fn(),
    save: jest.fn(),
  };
  return {
    planRepository,
    useCase: new UpdatePlanUseCase(planRepository, userRepository),
  };
}

async function expectAppException(
  promise: Promise<unknown>,
  status: HttpStatus,
  slug: string,
): Promise<void> {
  const caught: unknown = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(AppException);
  expect((caught as AppException).getStatus()).toBe(status);
  expect(JSON.stringify((caught as AppException).getResponse())).toContain(
    slug,
  );
}

const base = { coachId: 'coach-id', planId: 'plan-id' };

describe('UpdatePlanUseCase (US5)', () => {
  it('garde le budget saisi par le coach et date la serie calories', async () => {
    const { useCase, planRepository } = setup();
    const plan = await useCase.execute(
      { ...base, budgetCalorique: 1650 },
      maintenant,
    );
    expect(plan.toProps()).toMatchObject({
      budgetCalorique: 1650,
      budgetPlafonneAuBmr: false,
      budgetAjusteLe: maintenant,
    });
    expect(plan.toProps().poidsAjusteLe).toBeUndefined();
    expect(planRepository.updateActive).toHaveBeenCalledWith(plan);
  });

  it("recalcule le budget quand l'objectif change sans budget saisi", async () => {
    const { useCase } = setup();
    const plan = await useCase.execute(
      { ...base, poidsCible: 80, dateCible: new Date('2099-02-26') },
      maintenant,
    );
    const props = plan.toProps();
    expect(props.poidsCible).toBe(80);
    expect(props.budgetCalorique).not.toBe(1500);
    expect(props.poidsAjusteLe).toEqual(maintenant);
    expect(props.budgetAjusteLe).toEqual(maintenant);
  });

  it('exige le budget si age ou sexe manquent et que l’objectif change', async () => {
    const { useCase } = setup(undefined, buildUser({ age: undefined }));
    await expectAppException(
      useCase.execute({ ...base, poidsCible: 80 }, maintenant),
      HttpStatus.BAD_REQUEST,
      'incomplete-metabolic-profile',
    );
  });

  it('traduit une regle metier violee en 400 invalid-plan', async () => {
    const { useCase, planRepository } = setup();
    await expectAppException(
      useCase.execute({ ...base, poidsCible: 74 }, maintenant),
      HttpStatus.BAD_REQUEST,
      'invalid-plan',
    );
    expect(planRepository.updateActive).not.toHaveBeenCalled();
  });

  it('refuse une date cible deja passee', async () => {
    const { useCase } = setup();
    await expectAppException(
      useCase.execute(
        { ...base, dateCible: new Date('2099-01-09') },
        maintenant,
      ),
      HttpStatus.BAD_REQUEST,
      'invalid-plan',
    );
  });

  it('404 si le plan est introuvable', async () => {
    const { useCase } = setup(null);
    await expectAppException(
      useCase.execute({ ...base, budgetCalorique: 1600 }, maintenant),
      HttpStatus.NOT_FOUND,
      'plan-not-found',
    );
  });

  it("403 si l'utilisateur n'est pas rattache au coach", async () => {
    const { useCase } = setup(undefined, buildUser({ coachId: 'autre' }));
    await expectAppException(
      useCase.execute({ ...base, budgetCalorique: 1600 }, maintenant),
      HttpStatus.FORBIDDEN,
      'forbidden',
    );
  });

  it("409 si le plan n'est plus actif", async () => {
    const plan = Plan.create(basePlanProps);
    plan.cancel();
    const { useCase } = setup(plan);
    await expectAppException(
      useCase.execute({ ...base, budgetCalorique: 1600 }, maintenant),
      HttpStatus.CONFLICT,
      'plan-not-active',
    );
  });

  it('409 et resolution de l’expiration si la date cible est depassee', async () => {
    const { useCase, planRepository } = setup();
    await expectAppException(
      useCase.execute(
        { ...base, budgetCalorique: 1600 },
        new Date('2099-02-01T00:00:00Z'),
      ),
      HttpStatus.CONFLICT,
      'plan-not-active',
    );
    expect(planRepository.findActiveByUserId).toHaveBeenCalledWith('user-id');
  });
});
