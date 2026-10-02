import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { REFERENCE_FOODS } from '../src/foods/infrastructure/persistence/reference-foods';
import { DailyFoodJournal } from '../src/nutrition/domain/entities/daily-food-journal.entity';
import { FoodEntry } from '../src/nutrition/domain/entities/food-entry.entity';
import { Plan } from '../src/plans/domain/entities/plan.entity';
import { Suivi } from '../src/suivis/domain/entities/suivi.entity';
import { MongooseSuiviRepository } from '../src/suivis/infrastructure/persistence/mongoose-suivi.repository';

interface BudgetResponse {
  statut: string;
  budgetCalorique: number;
  ecartKcal: number | null;
  journal: {
    jourUtc: string;
    totalCaloriesKcal: number;
    entrees: { id: string }[];
  } | null;
}

describe('Statut du budget calorique (intégration)', () => {
  let app: INestApplication<App>;
  let suivis: MongooseSuiviRepository;
  let collection: Collection<{ _id: string }>;
  const userIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    suivis = app.get(MongooseSuiviRepository);
    collection = app
      .get<Connection>(getConnectionToken())
      .collection<{ _id: string }>('suivis');
  });

  afterAll(async () => {
    if (collection && userIds.length) {
      await collection.deleteMany({ _id: { $in: userIds } });
    }
    if (app) await app.close();
  });

  const token = (id: string, role = 'utilisateur') =>
    app.get(JwtService).sign({ sub: id, role });

  const status = (id: string, role = 'utilisateur') =>
    request(app.getHttpServer())
      .get('/api/food-journals/me/status')
      .auth(token(id, role), { type: 'bearer' });

  async function createUser() {
    const userId = randomUUID();
    userIds.push(userId);
    const plan = Plan.restore({
      id: randomUUID(),
      userId,
      coachId: randomUUID(),
      poidsDepart: 80,
      poidsCible: 75,
      dateDebut: new Date('2026-01-01T00:00:00Z'),
      dateCible: new Date('2099-12-31T00:00:00Z'),
      imcCible: 24,
      niveauActivite: 'actif',
      budgetCalorique: 1800,
      budgetPlafonneAuBmr: false,
      statut: 'actif',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const suivi = Suivi.create(userId);
    suivi.activerPlan(plan);
    expect(await suivis.creer(suivi)).toBe(true);
    return { userId, plan };
  }

  const add = (id: string, foodIndex: number, quantity: number) =>
    request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .auth(token(id), { type: 'bearer' })
      .send({
        foodId: REFERENCE_FOODS[foodIndex].id,
        quantiteGrammes: quantity,
      });

  it('réserve le statut à l’utilisateur et retourne null sans plan actif', async () => {
    await request(app.getHttpServer())
      .get('/api/food-journals/me/status')
      .expect(401);
    await status(randomUUID(), 'coach').expect(403);
    const response = await status(randomUUID()).expect(200);
    expect(response.body).toBeNull();
  });

  it('calcule le statut après chaque ajout puis ignore un journal devenu vide', async () => {
    const { userId } = await createUser();
    const empty = (await status(userId).expect(200)).body as BudgetResponse;
    expect(empty).toMatchObject({
      statut: 'pas-de-donnees-recentes',
      budgetCalorique: 1800,
      ecartKcal: null,
      journal: null,
    });

    const rice = await add(userId, 0, 200).expect(201);
    const within = (await status(userId).expect(200)).body as BudgetResponse;
    expect(within).toMatchObject({
      statut: 'dans-le-budget',
      ecartKcal: -1540,
      journal: { totalCaloriesKcal: 260 },
    });
    await add(userId, 15, 200).expect(201);
    const exceeded = (await status(userId).expect(200)).body as BudgetResponse;
    expect(exceeded).toMatchObject({
      statut: 'depassement',
      ecartKcal: 258,
      journal: { totalCaloriesKcal: 2058 },
    });

    const riceId = (rice.body as { entrees: { id: string }[] }).entrees[0].id;
    const oilId = exceeded.journal?.entrees[1].id;
    if (!oilId) throw new Error('Entrée huile introuvable');
    await request(app.getHttpServer())
      .delete(`/api/food-journals/me/entries/${riceId}`)
      .auth(token(userId), { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/food-journals/me/entries/${oilId}`)
      .auth(token(userId), { type: 'bearer' })
      .expect(200);
    const noData = (await status(userId).expect(200)).body as BudgetResponse;
    expect(noData).toMatchObject({
      statut: 'pas-de-donnees-recentes',
      ecartKcal: null,
      journal: null,
    });
  });

  it('ignore le journal vide du jour, puis déclare périmée une entrée d’avant-hier', async () => {
    const { userId, plan } = await createUser();
    const suivi = await suivis.charger(userId);
    if (!suivi) throw new Error('Suivi introuvable');
    const version = suivi.toProps().version;
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const yesterday = new Date(today.getTime() - 86_400_000);
    const older = new Date(today.getTime() - 2 * 86_400_000);
    const oldJournal = DailyFoodJournal.create(plan, older);
    oldJournal.ajouterEntree(
      FoodEntry.create({
        id: randomUUID(),
        aliment: REFERENCE_FOODS[15],
        quantiteGrammes: 300,
        receivedAt: older,
      }),
    );
    const yesterdayJournal = DailyFoodJournal.create(plan, yesterday);
    const yesterdayEntry = FoodEntry.create({
      id: randomUUID(),
      aliment: REFERENCE_FOODS[0],
      quantiteGrammes: 200,
      receivedAt: yesterday,
    });
    yesterdayJournal.ajouterEntree(yesterdayEntry);
    suivi.ajouterJournalAlimentaire(oldJournal, now);
    suivi.ajouterJournalAlimentaire(yesterdayJournal, now);
    suivi.ajouterJournalAlimentaire(DailyFoodJournal.create(plan, today), now);
    expect(await suivis.sauvegarderSiVersion(suivi, version)).toBe(true);

    const recent = (await status(userId).expect(200)).body as BudgetResponse;
    expect(recent).toMatchObject({
      statut: 'dans-le-budget',
      ecartKcal: -1540,
      journal: { jourUtc: yesterday.toISOString().slice(0, 10) },
    });

    await request(app.getHttpServer())
      .delete(`/api/food-journals/me/entries/${yesterdayEntry.toProps().id}`)
      .auth(token(userId), { type: 'bearer' })
      .expect(200);
    const stale = (await status(userId).expect(200)).body as BudgetResponse;
    expect(stale).toMatchObject({
      statut: 'pas-de-donnees-recentes',
      ecartKcal: null,
      journal: { jourUtc: older.toISOString().slice(0, 10) },
    });
  });
});
