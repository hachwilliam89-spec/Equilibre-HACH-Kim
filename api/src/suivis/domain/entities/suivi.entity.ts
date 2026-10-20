import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import { Measurement } from '../../../measurements/domain/entities/measurement.entity';
import { Plan } from '../../../plans/domain/entities/plan.entity';
import { DailyFoodJournal } from '../../../nutrition/domain/entities/daily-food-journal.entity';
import { ANCIENNETE_MAX_JOURS } from '../../../nutrition/domain/services/saisie-differee';

export const MAX_MESURES_SUIVI = 1000;

/** Nombre maximal de traces d'entrées alimentaires retirées conservées. */
export const MAX_ENTREES_RETIREES = 500;
const JOUR_MS = 86_400_000;
/**
 * Durée de conservation d'une trace : tant qu'un ajout différé de cette
 * entrée peut encore être rejoué (fenêtre de saisie différée), plus un jour
 * de marge pour les fuseaux et l'horloge de l'appareil.
 */
const CONSERVATION_TRACE_MS = (ANCIENNETE_MAX_JOURS + 1) * JOUR_MS;

/**
 * Preuve qu'une entrée alimentaire a existé puis a été retirée. Enregistrée
 * dans le même document que la suppression : un ajout rejoué après coup
 * (réponse perdue, retrait depuis un autre appareil) ne la recrée pas.
 */
export interface EntreeRetiree {
  id: string;
  /** Horodatage retenu de l'entrée retirée : borne sa durée de conservation. */
  consommeLe: Date;
  retireeLe: Date;
}

export interface BlocageJournalier {
  jourUtc: string;
  mesureId: string;
}

export interface SuiviProps {
  userId: string;
  version: number;
  planActif: Plan | null;
  plans: Plan[];
  mesures: Measurement[];
  derniereMesureValide: Measurement | null;
  blocageJournalier: BlocageJournalier | null;
  journauxAlimentaires: DailyFoodJournal[];
  entreesRetirees: EntreeRetiree[];
}

export class Suivi {
  private constructor(private props: SuiviProps) {}

  static create(userId: string): Suivi {
    return new Suivi({
      userId,
      version: 0,
      planActif: null,
      plans: [],
      mesures: [],
      derniereMesureValide: null,
      blocageJournalier: null,
      journauxAlimentaires: [],
      entreesRetirees: [],
    });
  }

  static restore(props: SuiviProps): Suivi {
    return new Suivi({
      ...props,
      plans: [...props.plans],
      mesures: [...props.mesures],
      journauxAlimentaires: [...props.journauxAlimentaires],
      // Documents antérieurs aux traces de retrait : aucune trace.
      entreesRetirees: [...(props.entreesRetirees ?? [])],
    });
  }

  activerPlan(plan: Plan): void {
    if (this.props.planActif) {
      throw new AppException(
        'plan-already-active',
        'Un plan actif existe deja pour cet utilisateur',
        HttpStatus.CONFLICT,
      );
    }
    this.props.planActif = plan;
    this.props.derniereMesureValide = null;
  }

  terminerPlan(plan: Plan): void {
    if (this.props.planActif?.id === plan.id) {
      this.props.planActif = null;
      const estReference =
        this.props.mesures.some(
          (measurement) => measurement.toProps().planId === plan.id,
        ) ||
        this.props.journauxAlimentaires.some(
          (journal) => journal.toProps().planId === plan.id,
        );
      this.props.plans = estReference
        ? [
            ...this.props.plans.filter((candidate) => candidate.id !== plan.id),
            plan,
          ]
        : this.props.plans.filter((candidate) => candidate.id !== plan.id);
      this.props.derniereMesureValide = null;
      return;
    }
    this.props.plans = this.props.plans.map((candidate) =>
      candidate.id === plan.id ? plan : candidate,
    );
  }

  ajouterJournalAlimentaire(
    journal: DailyFoodJournal,
    now: Date = new Date(`${journal.toProps().jourUtc}T00:00:00.000Z`),
  ): void {
    const props = journal.toProps();
    if (this.props.planActif?.id !== props.planId) {
      throw new AppException(
        'no-active-plan',
        'Aucun plan actif pour enregistrer un journal alimentaire',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    this.purgerHistorique(now);
    if (
      this.props.journauxAlimentaires.some(
        (item) =>
          item.toProps().planId === props.planId &&
          item.toProps().jourUtc === props.jourUtc,
      )
    ) {
      throw new AppException(
        'food-journal-conflict',
        'Un journal existe déjà pour ce plan et ce jour UTC',
        HttpStatus.CONFLICT,
      );
    }
    this.props.journauxAlimentaires.push(journal);
  }

  trouverJournalAlimentaire(
    planId: string,
    jourUtc: string,
  ): DailyFoodJournal | null {
    return (
      this.props.journauxAlimentaires.find(
        (journal) =>
          journal.toProps().planId === planId &&
          journal.toProps().jourUtc === jourUtc,
      ) ?? null
    );
  }

  trouverJournalParEntreeAlimentaire(entryId: string): DailyFoodJournal | null {
    return (
      this.props.journauxAlimentaires.find((journal) =>
        journal
          .toProps()
          .entrees.some((entry) => entry.toProps().id === entryId),
      ) ?? null
    );
  }

  /**
   * Retire une entrée et garde la trace de son retrait, purgée une fois que
   * son ajout ne peut plus être rejoué. null si l'entrée est inconnue.
   */
  retirerEntreeAlimentaire(
    entryId: string,
    maintenant: Date,
  ): DailyFoodJournal | null {
    const journal = this.trouverJournalParEntreeAlimentaire(entryId);
    if (!journal) return null;
    const entree = journal
      .toProps()
      .entrees.find((item) => item.toProps().id === entryId);
    if (!entree) return null;
    const limite = maintenant.getTime() - CONSERVATION_TRACE_MS;
    const traces = this.props.entreesRetirees.filter(
      (trace) => trace.consommeLe.getTime() >= limite,
    );
    const consommeLe = entree.toProps().receivedAt;
    const conserverTrace = consommeLe.getTime() >= limite;
    // Une preuve encore rejouable ne doit jamais etre evincee par la borne
    // de volume. Refuser avant toute mutation conserve le journal intact.
    if (conserverTrace && traces.length >= MAX_ENTREES_RETIREES) {
      throw new AppException(
        'food-entry-removal-limit',
        'Limite de retraits récents atteinte. Cette entrée est conservée ; réessayez dans quelques jours.',
        HttpStatus.CONFLICT,
      );
    }
    journal.retirerEntree(entryId);
    if (conserverTrace) {
      traces.push({
        id: entryId,
        consommeLe: new Date(consommeLe),
        retireeLe: new Date(maintenant),
      });
    }
    this.props.entreesRetirees = traces;
    return journal;
  }

  /** true si cette entrée a déjà été ajoutée puis retirée (rejeu à ignorer). */
  entreeAlimentaireRetiree(entryId: string): boolean {
    return this.props.entreesRetirees.some((trace) => trace.id === entryId);
  }

  retirerJournalAlimentaire(planId: string, jourUtc: string): void {
    this.props.journauxAlimentaires = this.props.journauxAlimentaires.filter(
      (journal) =>
        journal.toProps().planId !== planId ||
        journal.toProps().jourUtc !== jourUtc,
    );
  }

  ajouterMesure(
    measurement: Measurement,
    now = measurement.toProps().receivedAt,
  ): void {
    const props = measurement.toProps();
    if (this.props.planActif?.id !== props.planId) {
      throw new AppException(
        'no-active-plan',
        'Aucun plan actif pour enregistrer une mesure',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    this.purgerHistorique(now);
    const bloque = props.statut === 'valide' || props.source === 'manuelle';
    if (this.props.blocageJournalier?.jourUtc === props.jourUtc) {
      throw new AppException(
        'measurement-day-conflict',
        'Mesure déjà enregistrée aujourd’hui',
        HttpStatus.CONFLICT,
      );
    }
    if (this.props.mesures.length >= MAX_MESURES_SUIVI) {
      throw new AppException(
        'measurement-history-limit',
        'Limite de mesures récentes atteinte',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.props.mesures.push(measurement);
    if (props.statut === 'valide')
      this.props.derniereMesureValide = measurement;
    if (bloque) {
      this.props.blocageJournalier = {
        jourUtc: props.jourUtc,
        mesureId: props.id,
      };
    }
  }

  purgerHistorique(now: Date): void {
    const limite = troisMoisAvantUtc(now);
    this.props.mesures = this.props.mesures.filter(
      (measurement) => measurement.toProps().receivedAt >= limite,
    );
    this.props.journauxAlimentaires = this.props.journauxAlimentaires.filter(
      (journal) =>
        journal.toProps().jourUtc >= limite.toISOString().slice(0, 10),
    );
    const planIds = new Set([
      ...this.props.mesures.map((m) => m.toProps().planId),
      ...this.props.journauxAlimentaires.map((j) => j.toProps().planId),
    ]);
    this.props.plans = this.props.plans.filter((plan) => planIds.has(plan.id));
  }

  toProps(): SuiviProps {
    return {
      ...this.props,
      plans: [...this.props.plans],
      mesures: [...this.props.mesures],
      journauxAlimentaires: [...this.props.journauxAlimentaires],
      entreesRetirees: this.props.entreesRetirees.map((trace) => ({
        ...trace,
      })),
    };
  }
}

export function troisMoisAvantUtc(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() - 3;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay)),
  );
}
