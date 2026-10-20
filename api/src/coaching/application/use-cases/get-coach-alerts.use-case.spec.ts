import type { ClientOverview } from './get-clients-overview.use-case';
import type { GetClientsOverviewUseCase } from './get-clients-overview.use-case';
import { GetCoachAlertsUseCase } from './get-coach-alerts.use-case';

const client = (id: string, alertes: ClientOverview['alertes']) =>
  ({ utilisateur: { id }, alertes }) as unknown as ClientOverview;

describe('GetCoachAlertsUseCase (US5)', () => {
  it('ne garde que les utilisateurs rattachés ayant au moins une alerte', async () => {
    const alerte = {
      metrique: 'poids' as const,
      serie: 3,
      depuis: '2026-10-05',
      derniere: { jourUtc: '2026-10-07', ecart: 1.4, horsTolerance: true },
    };
    const execute = jest
      .fn()
      .mockResolvedValue([client('a', [alerte]), client('b', [])]);
    const useCase = new GetCoachAlertsUseCase({
      execute,
    } as unknown as GetClientsOverviewUseCase);

    const result = await useCase.execute('coach-1', '2026-10-08');

    expect(execute).toHaveBeenCalledWith('coach-1', '2026-10-08');
    expect(result.map((c) => c.utilisateur.id)).toEqual(['a']);
  });
});
