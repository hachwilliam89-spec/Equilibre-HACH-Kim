import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { REFERENCE_FOODS } from '../src/foods/infrastructure/persistence/reference-foods';
import { FoodEntry } from '../src/nutrition/domain/entities/food-entry.entity';
import { DailyFoodJournal } from '../src/nutrition/domain/entities/daily-food-journal.entity';
import { Plan } from '../src/plans/domain/entities/plan.entity';
import { Suivi } from '../src/suivis/domain/entities/suivi.entity';
import { MongooseSuiviRepository } from '../src/suivis/infrastructure/persistence/mongoose-suivi.repository';

interface StoredSuiviRow {
  _id: string;
  version: number;
  planActif?: null;
  plans?: unknown[];
  mesures?: unknown[];
  derniereMesureValide?: null;
  blocageJournalier?: null;
  journauxAlimentaires?: {
    planId: string;
    jourUtc: string;
    budgetCalorique: number;
    entrees: {
      id: string;
      aliment: { nom: string; caloriesKcalPour100g: number };
      caloriesKcal: number;
    }[];
    totalCaloriesKcal: number;
  }[];
}

describe('Journal alimentaire dans suivis (integration)', () => {
  let app: INestApplication<App>;
  let collection: Collection<StoredSuiviRow>;
  let repository: MongooseSuiviRepository;
  const userId = randomUUID();
  const legacyUserId = randomUUID();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    collection = app
      .get<Connection>(getConnectionToken())
      .collection<StoredSuiviRow>('suivis');
    repository = app.get(MongooseSuiviRepository);
  });

  afterAll(async () => {
    if (collection) {
      await collection.deleteOne({ _id: userId });
      await collection.deleteOne({ _id: legacyUserId });
    }
    if (app) await app.close();
  });

  it('persiste un journal imbriqué et refuse une écriture fondée sur une ancienne version', async () => {
    const plan = Plan.restore({
      id: randomUUID(),
      userId,
      coachId: randomUUID(),
      poidsDepart: 80,
      poidsCible: 75,
      dateDebut: new Date('2026-01-01T00:00:00Z'),
      dateCible: new Date('2026-12-31T00:00:00Z'),
      imcCible: 24,
      niveauActivite: 'actif',
      budgetCalorique: 1800,
      budgetPlafonneAuBmr: false,
      statut: 'actif',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const suivi = Suivi.create(userId);
    suivi.activerPlan(plan);
    const day = new Date('2026-10-02T10:00:00Z');
    const journal = DailyFoodJournal.create(plan, day);
    journal.ajouterEntree(
      FoodEntry.create({
        id: randomUUID(),
        aliment: REFERENCE_FOODS[0],
        quantiteGrammes: 200,
        receivedAt: day,
      }),
    );
    suivi.ajouterJournalAlimentaire(journal, day);
    expect(await repository.creer(suivi)).toBe(true);

    const row = await collection.findOne({ _id: userId });
    expect(row?.journauxAlimentaires).toHaveLength(1);
    expect(row?.journauxAlimentaires?.[0]).toMatchObject({
      planId: plan.id,
      jourUtc: '2026-10-02',
      budgetCalorique: 1800,
      totalCaloriesKcal: 260,
      entrees: [
        {
          aliment: { nom: 'Riz blanc cuit', caloriesKcalPour100g: 130 },
          caloriesKcal: 260,
        },
      ],
    });

    const first = await repository.charger(userId);
    const stale = await repository.charger(userId);
    expect(first).not.toBeNull();
    expect(stale).not.toBeNull();
    if (!first || !stale) throw new Error('Suivi introuvable');
    first.trouverJournalAlimentaire(plan.id, '2026-10-02')?.ajouterEntree(
      FoodEntry.create({
        id: randomUUID(),
        aliment: REFERENCE_FOODS[1],
        quantiteGrammes: 100,
        receivedAt: day,
      }),
    );
    expect(await repository.sauvegarderSiVersion(first, 0)).toBe(true);
    expect(await repository.sauvegarderSiVersion(stale, 0)).toBe(false);
    expect(
      (await collection.findOne({ _id: userId }))?.journauxAlimentaires?.[0],
    ).toMatchObject({ totalCaloriesKcal: 427 });
  });

  it('relit un suivi existant sans champ de journal alimentaire', async () => {
    await collection.insertOne({
      _id: legacyUserId,
      version: 0,
      planActif: null,
      plans: [],
      mesures: [],
      derniereMesureValide: null,
      blocageJournalier: null,
    });

    const suivi = await repository.charger(legacyUserId);
    expect(suivi?.toProps().journauxAlimentaires).toEqual([]);
  });
});
