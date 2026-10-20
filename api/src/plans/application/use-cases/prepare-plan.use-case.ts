import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Plan } from '../../domain/entities/plan.entity';
import {
  calculateBmr,
  calculateCalorieBudget,
  calculateWeeklyRateKgPerWeek,
  NiveauActivite,
} from '../../domain/services/metabolic-calculations';
import { USER_REPOSITORY } from '../../../auth/domain/ports/user-repository.port';
import type { UserRepositoryPort } from '../../../auth/domain/ports/user-repository.port';
import { AppException } from '../../../common/errors/app-exception';
import {
  SUIVI_REPOSITORY,
  type SuiviRepositoryPort,
} from '../../../suivis/domain/ports/suivi-repository.port';
import { moyenneSeptJours } from '../../../activity/domain/services/niveau-activite';

export interface PreparePlanInput {
  coachId: string;
  userId: string;
  poidsDepart: number;
  poidsCible: number;
  dateDebut: Date;
  dateCible: Date;
  /**
   * Choix du coach. Absent : déduit de la moyenne des 7 jours de pas
   * précédant le calcul (US4) ; refusé si cet historique est incomplet.
   */
  niveauActivite?: NiveauActivite;
  /** Valeur saisie par le coach : prévaut sur la suggestion automatique. */
  budgetCalorique?: number;
}

export interface PlanPrepare {
  plan: Plan;
  niveauActiviteSource: 'coach' | 'pas';
  /** Moyenne des 7 jours utilisée pour la déduction, sinon null. */
  moyennePas7Jours: number | null;
}

@Injectable()
export class PreparePlanUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(SUIVI_REPOSITORY)
    private readonly suivis: SuiviRepositoryPort,
  ) {}

  async execute(input: PreparePlanInput): Promise<Plan> {
    return (await this.prepare(input)).plan;
  }

  async prepare(
    input: PreparePlanInput,
    maintenant: Date = new Date(),
  ): Promise<PlanPrepare> {
    const user = await this.userRepository.findById(input.userId);
    if (
      !user ||
      user.role !== 'utilisateur' ||
      user.coachId !== input.coachId
    ) {
      throw new AppException(
        'invalid-user',
        'Utilisateur introuvable ou non rattache a ce coach',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.tailleCm) {
      throw new AppException(
        'missing-taille',
        'Taille non renseignee sur le profil utilisateur : completez-la avant de creer un plan',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Facteur figé ici : le plan enregistre le niveau retenu, de nouvelles
    // mesures de pas ne le recalculent jamais.
    let niveauActivite = input.niveauActivite;
    let moyennePas7Jours: number | null = null;
    if (!niveauActivite) {
      const suivi = await this.suivis.charger(input.userId);
      const moyenne = moyenneSeptJours(
        suivi?.toProps().pasQuotidiens ?? [],
        maintenant.toISOString().slice(0, 10),
      );
      if (!moyenne.niveau) {
        throw new AppException(
          'activity-level-required',
          `Moins de 7 jours de pas enregistres (${moyenne.joursRenseignes}/7) : choisissez le niveau d'activite`,
          HttpStatus.BAD_REQUEST,
        );
      }
      niveauActivite = moyenne.niveau;
      moyennePas7Jours = moyenne.moyennePas;
    }

    let budgetCalorique: number;
    let budgetPlafonneAuBmr: boolean;

    if (input.budgetCalorique !== undefined) {
      budgetCalorique = input.budgetCalorique;
      budgetPlafonneAuBmr = false;
    } else {
      if (!user.age || !user.sexe) {
        throw new AppException(
          'incomplete-metabolic-profile',
          'Profil incomplet (age/sexe manquants) : completez-le ou saisissez un budget calorique manuellement',
          HttpStatus.BAD_REQUEST,
        );
      }

      const rythme = calculateWeeklyRateKgPerWeek(
        input.poidsDepart,
        input.poidsCible,
        input.dateDebut,
        input.dateCible,
      );
      const bmr = calculateBmr({
        sexe: user.sexe,
        poidsKg: input.poidsDepart,
        tailleCm: user.tailleCm,
        age: user.age,
      });
      const budget = calculateCalorieBudget({
        bmr,
        niveauActivite,
        rythmeKgParSemaine: rythme,
      });
      budgetCalorique = budget.budget;
      budgetPlafonneAuBmr = budget.budgetPlafonneAuBmr;
    }

    let plan: Plan;
    try {
      plan = Plan.create({
        id: randomUUID(),
        userId: input.userId,
        coachId: input.coachId,
        poidsDepart: input.poidsDepart,
        poidsCible: input.poidsCible,
        dateDebut: input.dateDebut,
        dateCible: input.dateCible,
        tailleCm: user.tailleCm,
        niveauActivite,
        budgetCalorique,
        budgetPlafonneAuBmr,
        createdAt: new Date(),
      });
    } catch (error) {
      // Regles metier de Plan.create() (dates, poids, IMC, rythme) : leur
      // validation depend de donnees utilisateur (taille) non disponibles
      // au niveau du DTO Zod, donc pas de filet de securite en amont ici --
      // c'est le chemin de validation primaire, traduit en reponse HTTP 400.
      throw new AppException(
        'invalid-plan',
        error instanceof Error ? error.message : 'Plan invalide',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      plan,
      niveauActiviteSource: input.niveauActivite ? 'coach' : 'pas',
      moyennePas7Jours,
    };
  }
}
