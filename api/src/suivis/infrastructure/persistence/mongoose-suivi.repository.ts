import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Measurement,
  type MeasurementProps,
} from '../../../measurements/domain/entities/measurement.entity';
import {
  Plan,
  type PlanProps,
} from '../../../plans/domain/entities/plan.entity';
import { Suivi, troisMoisAvantUtc } from '../../domain/entities/suivi.entity';
import type { SuiviRepositoryPort } from '../../domain/ports/suivi-repository.port';
import { SuiviDocumentClass } from './suivi.schema';
import {
  DailyFoodJournal,
  type DailyFoodJournalProps,
} from '../../../nutrition/domain/entities/daily-food-journal.entity';
import {
  FoodEntry,
  type FoodEntryProps,
} from '../../../nutrition/domain/entities/food-entry.entity';

type StoredFoodJournal = Omit<DailyFoodJournalProps, 'entrees'> & {
  entrees: FoodEntryProps[];
};

interface StoredSuivi {
  _id: string;
  version: number;
  planActif: PlanProps | null;
  plans: PlanProps[];
  mesures: MeasurementProps[];
  derniereMesureValide: MeasurementProps | null;
  blocageJournalier: { jourUtc: string; mesureId: string } | null;
  journauxAlimentaires: StoredFoodJournal[];
}

@Injectable()
export class MongooseSuiviRepository implements SuiviRepositoryPort {
  constructor(
    @InjectModel(SuiviDocumentClass.name)
    private readonly model: Model<SuiviDocumentClass>,
  ) {}

  async charger(userId: string): Promise<Suivi | null> {
    const document = await this.model.findById(userId).lean().exec();
    return document ? this.toDomain(document) : null;
  }

  async chercherParPlanId(planId: string): Promise<Suivi | null> {
    const document = await this.model
      .findOne({ $or: [{ 'planActif.id': planId }, { 'plans.id': planId }] })
      .lean()
      .exec();
    return document ? this.toDomain(document) : null;
  }

  async lireHistorique(userId: string): Promise<Measurement[]> {
    const rows = await this.model
      .aggregate<{ mesures: MeasurementProps[] }>([
        { $match: { _id: userId } },
        {
          $project: {
            _id: 0,
            mesures: {
              $filter: {
                input: '$mesures',
                as: 'measurement',
                cond: {
                  $gte: [
                    '$$measurement.receivedAt',
                    troisMoisAvantUtc(new Date()),
                  ],
                },
              },
            },
          },
        },
      ])
      .exec();
    return (rows[0]?.mesures ?? []).map((measurement) =>
      Measurement.restore(measurement),
    );
  }

  async lireMesureValideDuJour(
    userId: string,
    jourUtc: string,
    planId?: string,
  ): Promise<Measurement | null> {
    const conditions: Record<string, unknown>[] = [
      { $eq: ['$$measurement.jourUtc', jourUtc] },
      { $eq: ['$$measurement.statut', 'valide'] },
    ];
    if (planId) conditions.push({ $eq: ['$$measurement.planId', planId] });
    const rows = await this.model
      .aggregate<{ measurement?: MeasurementProps }>([
        { $match: { _id: userId } },
        {
          $project: {
            _id: 0,
            measurement: {
              $first: {
                $filter: {
                  input: '$mesures',
                  as: 'measurement',
                  cond: { $and: conditions },
                },
              },
            },
          },
        },
      ])
      .exec();
    return rows[0]?.measurement
      ? Measurement.restore(rows[0].measurement)
      : null;
  }

  async lireDerniereMesureValide(userId: string): Promise<Measurement | null> {
    const document = await this.model
      .findById(userId)
      .select({ _id: 0, derniereMesureValide: 1 })
      .lean()
      .exec();
    return document?.derniereMesureValide
      ? Measurement.restore(document.derniereMesureValide)
      : null;
  }

  async creer(suivi: Suivi): Promise<boolean> {
    try {
      await this.model.create(this.toDocument(suivi));
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async sauvegarderSiVersion(
    suivi: Suivi,
    versionAttendue: number,
  ): Promise<boolean> {
    const stored = this.toDocument(suivi);
    const result = await this.model
      .updateOne(
        { _id: stored._id, version: versionAttendue },
        {
          $set: {
            planActif: stored.planActif,
            plans: stored.plans,
            mesures: stored.mesures,
            derniereMesureValide: stored.derniereMesureValide,
            blocageJournalier: stored.blocageJournalier,
            journauxAlimentaires: stored.journauxAlimentaires,
          },
          $inc: { version: 1 },
        },
        { runValidators: true },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  private toDocument(suivi: Suivi): StoredSuivi {
    const props = suivi.toProps();
    return {
      _id: props.userId,
      version: props.version,
      planActif: props.planActif?.toProps() ?? null,
      plans: props.plans.map((plan) => plan.toProps()),
      mesures: props.mesures.map((measurement) => measurement.toProps()),
      derniereMesureValide: props.derniereMesureValide?.toProps() ?? null,
      blocageJournalier: props.blocageJournalier,
      journauxAlimentaires: props.journauxAlimentaires.map((journal) => {
        const journalProps = journal.toProps();
        return {
          ...journalProps,
          entrees: journalProps.entrees.map((entry) => entry.toProps()),
        };
      }),
    };
  }

  private toDomain(document: StoredSuivi): Suivi {
    return Suivi.restore({
      userId: document._id,
      version: document.version,
      planActif: document.planActif ? Plan.restore(document.planActif) : null,
      plans: document.plans.map((plan) => Plan.restore(plan)),
      mesures: document.mesures.map((measurement) =>
        Measurement.restore(measurement),
      ),
      derniereMesureValide: document.derniereMesureValide
        ? Measurement.restore(document.derniereMesureValide)
        : null,
      blocageJournalier: document.blocageJournalier,
      journauxAlimentaires: (document.journauxAlimentaires ?? []).map(
        (journal) =>
          DailyFoodJournal.restore({
            ...journal,
            entrees: journal.entrees.map((entry) => FoodEntry.restore(entry)),
          }),
      ),
    });
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
