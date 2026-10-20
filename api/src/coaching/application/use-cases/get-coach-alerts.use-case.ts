import { Injectable } from '@nestjs/common';
import {
  GetClientsOverviewUseCase,
  type ClientOverview,
} from './get-clients-overview.use-case';

/**
 * Alertes d'écart persistant des utilisateurs rattachés au coach (US5) :
 * seuls les utilisateurs ayant au moins une alerte sont renvoyés. Le
 * rattachement est le filtre : un coach ne voit jamais les alertes d'un
 * autre.
 */
@Injectable()
export class GetCoachAlertsUseCase {
  constructor(private readonly overview: GetClientsOverviewUseCase) {}

  async execute(
    coachId: string,
    jourCourantUtc?: string,
  ): Promise<ClientOverview[]> {
    const clients = await this.overview.execute(coachId, jourCourantUtc);
    return clients.filter((client) => client.alertes.length > 0);
  }
}
