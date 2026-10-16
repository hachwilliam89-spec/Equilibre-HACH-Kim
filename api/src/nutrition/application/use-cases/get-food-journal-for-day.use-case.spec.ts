import { AppException } from '../../../common/errors/app-exception';
import { Plan } from '../../../plans/domain/entities/plan.entity';
import { Suivi } from '../../../suivis/domain/entities/suivi.entity';
import type { SuiviRepositoryPort } from '../../../suivis/domain/ports/suivi-repository.port';
import { DailyFoodJournal } from '../../domain/entities/daily-food-journal.entity';
import { GetFoodJournalForDayUseCase } from './get-food-journal-for-day.use-case';

const maintenant = new Date('2026-10-16T10:00:00Z');
const plan = (id: string) =>
  Plan.restore({
    id,
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

function setup(suivi: Suivi | null) {
  const suivis = {
    charger: jest.fn().mockResolvedValue(suivi),
  } as unknown as SuiviRepositoryPort;
  return new GetFoodJournalForDayUseCase(suivis);
}

function suiviAvecJournaux(): Suivi {
  const actif = plan('plan-actif');
  const ancien = plan('ancien');
  const base = Suivi.create('user-1');
  base.activerPlan(actif);
  return Suivi.restore({
    ...base.toProps(),
    plans: [ancien],
    journauxAlimentaires: [
      DailyFoodJournal.create(ancien, new Date('2026-10-12T09:00:00Z')),
      DailyFoodJournal.create(actif, new Date('2026-10-12T12:00:00Z')),
      DailyFoodJournal.create(actif, new Date('2026-10-14T12:00:00Z')),
    ],
  });
}

describe('GetFoodJournalForDayUseCase', () => {
  it('renvoie le journal du jour demande', async () => {
    const journal = await setup(suiviAvecJournaux()).execute(
      'user-1',
      '2026-10-14',
      maintenant,
    );

    expect(journal?.toProps().jourUtc).toBe('2026-10-14');
  });

  it('prefere le journal du plan actif quand deux plans ont le meme jour', async () => {
    const journal = await setup(suiviAvecJournaux()).execute(
      'user-1',
      '2026-10-12',
      maintenant,
    );

    expect(journal?.toProps().planId).toBe('plan-actif');
  });

  it('renvoie null pour un jour sans journal ou sans suivi', async () => {
    await expect(
      setup(suiviAvecJournaux()).execute('user-1', '2026-10-13', maintenant),
    ).resolves.toBeNull();
    await expect(
      setup(null).execute('user-1', '2026-10-13', maintenant),
    ).resolves.toBeNull();
  });

  it('accepte le jour meme mais refuse une journee future', async () => {
    const useCase = setup(suiviAvecJournaux());

    await expect(
      useCase.execute('user-1', '2026-10-16', maintenant),
    ).resolves.toBeNull();
    await expect(
      useCase.execute('user-1', '2026-10-17', maintenant),
    ).rejects.toBeInstanceOf(AppException);
  });
});
