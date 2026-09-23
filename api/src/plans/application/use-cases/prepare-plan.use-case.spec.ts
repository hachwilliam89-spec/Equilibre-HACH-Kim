import { HttpStatus } from '@nestjs/common';
import { PreparePlanUseCase } from './prepare-plan.use-case';
import { User, UserProps } from '../../../auth/domain/entities/user.entity';
import { AppException } from '../../../common/errors/app-exception';
import {
  calculateBmr,
  calculateCalorieBudget,
  calculateWeeklyRateKgPerWeek,
} from '../../domain/services/metabolic-calculations';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';

const dateDebut = new Date('2026-01-01');
const dateCible = new Date('2026-01-29'); // 4 semaines

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

function buildUserRepository(): jest.Mocked<UserRepositoryPort> {
  return {
    findByCoachId: jest.fn(),
    findByCoachCode: jest.fn(),
    ensureCoachCode: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
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

describe('PreparePlanUseCase', () => {
  it("calcule automatiquement le budget calorique quand il n'est pas fourni (cas nominal)", async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(buildUser());

    const useCase = new PreparePlanUseCase(userRepository);
    const plan = await useCase.execute({
      coachId: 'coach-id',
      userId: 'user-id',
      poidsDepart: 82,
      poidsCible: 78,
      dateDebut,
      dateCible,
      niveauActivite: 'sedentaire',
    });

    // Rejoue le meme calcul metier (fonctions pures) pour eviter de dupliquer
    // la formule en dur dans le test.
    const rythme = calculateWeeklyRateKgPerWeek(82, 78, dateDebut, dateCible);
    const bmr = calculateBmr({
      sexe: 'femme',
      poidsKg: 82,
      tailleCm: 170,
      age: 30,
    });
    const attendu = calculateCalorieBudget({
      bmr,
      niveauActivite: 'sedentaire',
      rythmeKgParSemaine: rythme,
    });

    const props = plan.toProps();
    expect(props.budgetCalorique).toBeCloseTo(attendu.budget);
    expect(props.budgetPlafonneAuBmr).toBe(attendu.budgetPlafonneAuBmr);
  });

  it('utilise le budget fourni par le coach sans le plafonner, meme profil metabolique incomplet', async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(
      buildUser({ age: undefined, sexe: undefined }),
    );

    const useCase = new PreparePlanUseCase(userRepository);
    const plan = await useCase.execute({
      coachId: 'coach-id',
      userId: 'user-id',
      poidsDepart: 82,
      poidsCible: 78,
      dateDebut,
      dateCible,
      niveauActivite: 'sedentaire',
      budgetCalorique: 2000,
    });

    const props = plan.toProps();
    expect(props.budgetCalorique).toBe(2000);
    expect(props.budgetPlafonneAuBmr).toBe(false);
  });

  it("leve invalid-user (403) si l'utilisateur est introuvable", async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(null);

    const useCase = new PreparePlanUseCase(userRepository);
    await expectAppException(
      useCase.execute({
        coachId: 'coach-id',
        userId: 'inconnu',
        poidsDepart: 82,
        poidsCible: 78,
        dateDebut,
        dateCible,
        niveauActivite: 'sedentaire',
      }),
      HttpStatus.FORBIDDEN,
    );
  });

  it('leve invalid-user (403) si la cible a le role coach', async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(
      buildUser({ role: 'coach', coachId: undefined }),
    );

    const useCase = new PreparePlanUseCase(userRepository);
    await expectAppException(
      useCase.execute({
        coachId: 'coach-id',
        userId: 'user-id',
        poidsDepart: 82,
        poidsCible: 78,
        dateDebut,
        dateCible,
        niveauActivite: 'sedentaire',
      }),
      HttpStatus.FORBIDDEN,
    );
  });

  it("leve invalid-user (403) si l'utilisateur n'est pas rattache a ce coach", async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(
      buildUser({ coachId: 'autre-coach' }),
    );

    const useCase = new PreparePlanUseCase(userRepository);
    await expectAppException(
      useCase.execute({
        coachId: 'coach-id',
        userId: 'user-id',
        poidsDepart: 82,
        poidsCible: 78,
        dateDebut,
        dateCible,
        niveauActivite: 'sedentaire',
      }),
      HttpStatus.FORBIDDEN,
    );
  });

  it('leve missing-taille (400) si la taille du profil est absente', async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(
      buildUser({ tailleCm: undefined }),
    );

    const useCase = new PreparePlanUseCase(userRepository);
    await expectAppException(
      useCase.execute({
        coachId: 'coach-id',
        userId: 'user-id',
        poidsDepart: 82,
        poidsCible: 78,
        dateDebut,
        dateCible,
        niveauActivite: 'sedentaire',
      }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('leve incomplete-metabolic-profile (400) si age/sexe manquent et aucun budget fourni', async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(
      buildUser({ age: undefined, sexe: undefined }),
    );

    const useCase = new PreparePlanUseCase(userRepository);
    await expectAppException(
      useCase.execute({
        coachId: 'coach-id',
        userId: 'user-id',
        poidsDepart: 82,
        poidsCible: 78,
        dateDebut,
        dateCible,
        niveauActivite: 'sedentaire',
      }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('leve invalid-plan (400) si les regles metier de Plan.create() sont violees', async () => {
    const userRepository = buildUserRepository();
    userRepository.findById.mockResolvedValue(buildUser());

    const useCase = new PreparePlanUseCase(userRepository);
    await expectAppException(
      useCase.execute({
        coachId: 'coach-id',
        userId: 'user-id',
        poidsDepart: 82,
        poidsCible: 82, // poids cible = poids depart -> refuse par Plan.create()
        dateDebut,
        dateCible,
        niveauActivite: 'sedentaire',
        budgetCalorique: 1500, // evite la branche de calcul automatique
      }),
      HttpStatus.BAD_REQUEST,
    );
  });
});
