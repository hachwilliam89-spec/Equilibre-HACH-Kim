import { HttpStatus } from '@nestjs/common';
import { CreatePlanUseCase } from './create-plan.use-case';
import { PreparePlanUseCase } from './prepare-plan.use-case';
import { Plan, PlanCreateProps } from '../../domain/entities/plan.entity';
import { AppException } from '../../../common/errors/app-exception';
import type { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';

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

function buildPlanRepository(): jest.Mocked<PlanRepositoryPort> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findActiveByUserId: jest.fn(),
    save: jest.fn(),
  };
}

// PreparePlanUseCase est mocke ici : sa propre logique est couverte par
// prepare-plan.use-case.spec.ts. CreatePlanUseCase n'est responsable que de
// l'orchestration (revalidation + verification d'unicite du plan actif).
function buildPreparePlanUseCase(plan: Plan): { execute: jest.Mock } {
  return {
    execute: jest.fn().mockResolvedValue(plan),
  };
}

describe('CreatePlanUseCase', () => {
  it("cree le plan si aucun plan actif n'existe deja pour l'utilisateur (cas nominal)", async () => {
    const plan = Plan.create(basePlanProps);
    const planRepository = buildPlanRepository();
    const preparePlanUseCase = buildPreparePlanUseCase(plan);
    planRepository.findActiveByUserId.mockResolvedValue(null);
    planRepository.create.mockResolvedValue(plan);

    const useCase = new CreatePlanUseCase(
      planRepository,
      preparePlanUseCase as unknown as PreparePlanUseCase,
    );
    const result = await useCase.execute({
      coachId: 'coach-id',
      userId: 'user-id',
      poidsDepart: 82,
      poidsCible: 78,
      dateDebut: basePlanProps.dateDebut,
      dateCible: basePlanProps.dateCible,
      niveauActivite: 'sedentaire',
    });

    expect(preparePlanUseCase.execute).toHaveBeenCalled();
    expect(planRepository.create).toHaveBeenCalledWith(plan);
    expect(result).toBe(plan);
  });

  it('leve plan-already-active (409) si un plan actif existe deja', async () => {
    const plan = Plan.create(basePlanProps);
    const planRepository = buildPlanRepository();
    const preparePlanUseCase = buildPreparePlanUseCase(plan);
    planRepository.findActiveByUserId.mockResolvedValue(plan);

    const useCase = new CreatePlanUseCase(
      planRepository,
      preparePlanUseCase as unknown as PreparePlanUseCase,
    );

    expect.assertions(3);
    try {
      await useCase.execute({
        coachId: 'coach-id',
        userId: 'user-id',
        poidsDepart: 82,
        poidsCible: 78,
        dateDebut: basePlanProps.dateDebut,
        dateCible: basePlanProps.dateCible,
        niveauActivite: 'sedentaire',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
    expect(planRepository.create).not.toHaveBeenCalled();
  });

  it('propage telle quelle une erreur de preparation (ex : plan invalide)', async () => {
    const planRepository = buildPlanRepository();
    const preparationError = new AppException(
      'invalid-plan',
      'Plan invalide',
      HttpStatus.BAD_REQUEST,
    );
    const preparePlanUseCase = {
      execute: jest.fn().mockRejectedValue(preparationError),
    };

    const useCase = new CreatePlanUseCase(
      planRepository,
      preparePlanUseCase as unknown as PreparePlanUseCase,
    );

    await expect(
      useCase.execute({
        coachId: 'coach-id',
        userId: 'user-id',
        poidsDepart: 82,
        poidsCible: 82,
        dateDebut: basePlanProps.dateDebut,
        dateCible: basePlanProps.dateCible,
        niveauActivite: 'sedentaire',
      }),
    ).rejects.toBe(preparationError);
    expect(planRepository.findActiveByUserId).not.toHaveBeenCalled();
    expect(planRepository.create).not.toHaveBeenCalled();
  });
});
