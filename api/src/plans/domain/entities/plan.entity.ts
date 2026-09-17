import {
  calculateImc,
  calculateWeeklyRateKgPerWeek,
  NiveauActivite,
} from '../services/metabolic-calculations';

export type PlanStatut = 'actif' | 'termine' | 'annule';

/** Seuil de dénutrition reconnu (IMC) — plafond absolu, quel que soit le
 * point de départ (le rythme, pas l'IMC final, est le vrai garde-fou). */
const IMC_MINIMUM = 18.5;

/** Rythme hebdomadaire maximum autorisé, en kg/semaine. */
const RYTHME_MAX_PERTE = 1;
const RYTHME_MAX_PRISE = 0.5;

export interface PlanProps {
  id: string;
  userId: string;
  coachId: string;
  poidsDepart: number;
  poidsCible: number;
  dateDebut: Date;
  dateCible: Date;
  imcCible: number;
  niveauActivite: NiveauActivite;
  budgetCalorique: number;
  budgetPlafonneAuBmr: boolean;
  statut: PlanStatut;
  createdAt: Date;
}

/** Champs fournis à la création, avant calcul de l'IMC (dérivé de
 * poidsCible + tailleCm) — statut/imcCible ne sont pas à la charge de
 * l'appelant. */
export type PlanCreateProps = Omit<PlanProps, 'imcCible' | 'statut'> & {
  tailleCm: number;
};

export class Plan {
  private constructor(private props: PlanProps) {}

  static create(input: PlanCreateProps): Plan {
    if (input.dateCible.getTime() <= input.dateDebut.getTime()) {
      throw new Error(
        'La date cible doit être strictement postérieure à la date de début',
      );
    }

    if (input.poidsCible === input.poidsDepart) {
      throw new Error('Le poids cible doit être différent du poids de départ');
    }

    const imcCible = calculateImc(input.poidsCible, input.tailleCm);
    if (imcCible < IMC_MINIMUM) {
      throw new Error(
        `IMC cible (${imcCible.toFixed(1)}) sous le seuil de dénutrition (${IMC_MINIMUM})`,
      );
    }

    const rythme = calculateWeeklyRateKgPerWeek(
      input.poidsDepart,
      input.poidsCible,
      input.dateDebut,
      input.dateCible,
    );
    if (rythme < 0 && Math.abs(rythme) > RYTHME_MAX_PERTE) {
      throw new Error(
        `Rythme de perte trop rapide (${Math.abs(rythme).toFixed(2)} kg/semaine, maximum ${RYTHME_MAX_PERTE})`,
      );
    }
    if (rythme > 0 && rythme > RYTHME_MAX_PRISE) {
      throw new Error(
        `Rythme de prise de masse trop rapide (${rythme.toFixed(2)} kg/semaine, maximum ${RYTHME_MAX_PRISE})`,
      );
    }

    return new Plan({
      id: input.id,
      userId: input.userId,
      coachId: input.coachId,
      poidsDepart: input.poidsDepart,
      poidsCible: input.poidsCible,
      dateDebut: input.dateDebut,
      dateCible: input.dateCible,
      imcCible,
      niveauActivite: input.niveauActivite,
      budgetCalorique: input.budgetCalorique,
      budgetPlafonneAuBmr: input.budgetPlafonneAuBmr,
      statut: 'actif',
      createdAt: input.createdAt,
    });
  }

  /** Reconstruction depuis la persistance — aucune validation (déjà faite à
   * la création), simple restauration de l'état stocké. */
  static restore(props: PlanProps): Plan {
    return new Plan(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get coachId(): string {
    return this.props.coachId;
  }

  get statut(): PlanStatut {
    return this.props.statut;
  }

  get dateCible(): Date {
    return this.props.dateCible;
  }

  hasExpired(now: Date): boolean {
    return this.props.dateCible.getTime() < now.getTime();
  }

  /** Passage automatique en 'terminé' (date cible dépassée). Idempotent. */
  terminate(): void {
    if (this.props.statut === 'actif') {
      this.props = { ...this.props, statut: 'termine' };
    }
  }

  /** Annulation manuelle par le coach. Refuse si le plan n'est plus actif. */
  cancel(): void {
    if (this.props.statut !== 'actif') {
      throw new Error('Seul un plan actif peut être annulé');
    }
    this.props = { ...this.props, statut: 'annule' };
  }

  toProps(): PlanProps {
    return { ...this.props };
  }
}
