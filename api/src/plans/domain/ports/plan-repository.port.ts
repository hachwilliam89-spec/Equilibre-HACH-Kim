import { Plan } from '../entities/plan.entity';

export interface PlanRepositoryPort {
  create: (plan: Plan) => Promise<Plan>;
  findById: (id: string) => Promise<Plan | null>;
  /**
   * Plan actif d'un utilisateur, le cas échéant. Vérifie paresseusement
   * l'expiration : si le plan trouvé a sa date cible dépassée et est encore
   * marqué 'actif', le fait passer à 'termine' et persiste ce changement
   * avant de le retourner (pas de scheduler/cron dédié pour ce MVP).
   * Retourne null si aucun plan actif (y compris un plan qui vient d'être
   * automatiquement terminé par cet appel).
   */
  findActiveByUserId: (userId: string) => Promise<Plan | null>;
  save: (plan: Plan) => Promise<Plan>;
}

export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
