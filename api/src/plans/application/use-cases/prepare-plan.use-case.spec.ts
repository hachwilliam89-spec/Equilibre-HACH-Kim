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
import type { SuiviRepositoryPort } from '../../../suivis/domain/ports/suivi-repository.port';
import { Suivi } from '../../../suivis/domain/entities/suivi.entity';

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

function buildSuiviRepository(
  suivi: Suivi | null = null,
): jest.Mocked<SuiviRepositoryPort> {
  return {
    charger: jest.fn().mockResolvedValue(suivi),
    chercherParPlanId: jest.fn(),
    lireHistorique: jest.fn(),
    lireMesureValideDuJour: jest.fn(),
    lireDerniereMesureValide: jest.fn(),
    lireDernierJournalAlimentaireAvecEntrees: jest.fn(),
    creer: jest.fn(),
    sauvegarderSiVersion: jest.fn(),
  };
}

/** Suivi avec un total de pas pour chacun des jours donnés (20 h UTC). */
function suiviAvecPas(jours: Record<string, number>): Suivi {
  const suivi = Suivi.create('user-id');
  for (const [jourUtc, nombrePas] of Object.entries(jours)) {
    suivi.enregistrerPas(nombrePas, new Date(`${jourUtc}T20:00:00.000Z`));
  }
  return suivi;
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

    const useCase = new PreparePlanUseCase(
      userRepository,
      buildSuiviRepository(),
    );
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

  describe('niveau d’activité déduit des pas (US4)', () => {
    const base = {
      coachId: 'coach-id',
      userId: 'user-id',
      poidsDepart: 82,
      poidsCible: 80,
      dateDebut: new Date('2026-10-08'),
      dateCible: new Date('2026-11-05'),
    };
    const maintenant = new Date('2026-10-08T10:00:00.000Z');
    const semaine = {
      '2026-10-01': 8000,
      '2026-10-02': 8200,
      '2026-10-03': 8400,
      '2026-10-04': 8100,
      '2026-10-05': 8300,
      '2026-10-06': 7900,
      '2026-10-07': 8500,
    };

    it('déduit Sportif d’une moyenne de 8 200 pas et applique le facteur 1,55', async () => {
      const userRepository = buildUserRepository();
      userRepository.findById.mockResolvedValue(buildUser());
      const useCase = new PreparePlanUseCase(
        userRepository,
        buildSuiviRepository(suiviAvecPas(semaine)),
      );

      const resultat = await useCase.prepare(base, maintenant);
      const attendu = await new PreparePlanUseCase(
        userRepository,
        buildSuiviRepository(),
      ).prepare({ ...base, niveauActivite: 'sportif' }, maintenant);

      expect(resultat.niveauActiviteSource).toBe('pas');
      expect(resultat.moyennePas7Jours).toBe(8200);
      expect(resultat.plan.toProps().niveauActivite).toBe('sportif');
      expect(resultat.plan.toProps().budgetCalorique).toBe(
        attendu.plan.toProps().budgetCalorique,
      );
    });

    it('laisse le choix du coach prévaloir sur les pas', async () => {
      const userRepository = buildUserRepository();
      userRepository.findById.mockResolvedValue(buildUser());
      const useCase = new PreparePlanUseCase(
        userRepository,
        buildSuiviRepository(suiviAvecPas(semaine)),
      );

      const resultat = await useCase.prepare(
        { ...base, niveauActivite: 'actif' },
        maintenant,
      );

      expect(resultat.niveauActiviteSource).toBe('coach');
      expect(resultat.moyennePas7Jours).toBeNull();
      expect(resultat.plan.toProps().niveauActivite).toBe('actif');
    });

    it('refuse sans niveau quand moins de 7 jours sont renseignés', async () => {
      const userRepository = buildUserRepository();
      userRepository.findById.mockResolvedValue(buildUser());
      const useCase = new PreparePlanUseCase(
        userRepository,
        buildSuiviRepository(
          suiviAvecPas({
            '2026-10-05': 8000,
            '2026-10-06': 8200,
            '2026-10-07': 8400,
          }),
        ),
      );

      await expectAppException(
        useCase.prepare(base, maintenant),
        HttpStatus.BAD_REQUEST,
      );
      await useCase.prepare(base, maintenant).catch((error: AppException) => {
        expect(error.getResponse()).toMatchObject({
          type: expect.stringMatching(/activity-level-required$/) as string,
        });
      });
    });

    it('refuse sans niveau quand l’utilisateur n’a encore aucun suivi', async () => {
      const userRepository = buildUserRepository();
      userRepository.findById.mockResolvedValue(buildUser());
      const useCase = new PreparePlanUseCase(
        userRepository,
        buildSuiviRepository(null),
      );

      await expectAppException(
        useCase.prepare(base, maintenant),
        HttpStatus.BAD_REQUEST,
      );
    });
  });
});
