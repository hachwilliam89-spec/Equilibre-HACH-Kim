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
import { Plan } from '../src/plans/domain/entities/plan.entity';
import { Suivi } from '../src/suivis/domain/entities/suivi.entity';
import { MongooseSuiviRepository } from '../src/suivis/infrastructure/persistence/mongoose-suivi.repository';

interface StoredSuivi {
  _id: string;
  version: number;
  journauxAlimentaires: {
    planId: string;
    jourUtc: string;
    entrees: {
      aliment: { nom: string; caloriesKcalPour100g: number };
      categorieRepas?: string;
    }[];
    totalCaloriesKcal: number;
  }[];
}

interface FoodJournalResponse {
  jourUtc: string;
  entrees: { receivedAt: string }[];
}

describe('Ajout d’une entrée alimentaire (intégration)', () => {
  let app: INestApplication<App>;
  let suivis: MongooseSuiviRepository;
  let collection: Collection<StoredSuivi>;
  const userId = randomUUID();
  const concurrentUserId = randomUUID();
  const forgedUserId = randomUUID();
  const mixedUserId = randomUUID();

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
      .collection<StoredSuivi>('suivis');
    await Promise.all(
      [userId, concurrentUserId, forgedUserId, mixedUserId].map(createSuivi),
    );
  });

  afterAll(async () => {
    if (collection) {
      await collection.deleteMany({
        _id: { $in: [userId, concurrentUserId, forgedUserId, mixedUserId] },
      });
    }
    if (app) await app.close();
  });

  async function createSuivi(id: string) {
    const suivi = Suivi.create(id);
    suivi.activerPlan(
      Plan.restore({
        id: randomUUID(),
        userId: id,
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
      }),
    );
    expect(await suivis.creer(suivi)).toBe(true);
  }

  const token = (id: string, role = 'utilisateur') =>
    app.get(JwtService).sign({ sub: id, role });

  const add = (
    id: string,
    foodId: string,
    quantiteGrammes: unknown,
    categorieRepas?: string,
  ) =>
    request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .auth(token(id), { type: 'bearer' })
      .send({
        foodId,
        quantiteGrammes,
        ...(categorieRepas ? { categorieRepas } : {}),
      });

  it('exige un utilisateur connecté, un aliment existant et une quantité valide', async () => {
    await request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .send({ foodId: REFERENCE_FOODS[0].id, quantiteGrammes: 200 })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .auth(token(userId, 'coach'), { type: 'bearer' })
      .send({ foodId: REFERENCE_FOODS[0].id, quantiteGrammes: 200 })
      .expect(403);
    await add(randomUUID(), REFERENCE_FOODS[0].id, 200).expect(422);
    await add(userId, randomUUID(), 200).expect(404);
    await add(userId, REFERENCE_FOODS[0].id, 0).expect(400);
    await add(userId, REFERENCE_FOODS[0].id, -1).expect(400);
    await add(userId, REFERENCE_FOODS[0].id, '200').expect(400);
    await add(userId, REFERENCE_FOODS[0].id, 10001).expect(400);
    await add(userId, 'invalide', 200).expect(400);
    await add(userId, REFERENCE_FOODS[0].id, 200, 'gouter').expect(400);
    expect(
      (await collection.findOne({ _id: userId }))?.journauxAlimentaires,
    ).toEqual([]);
  });

  it('calcule les calories et macros pour la quantité et recalcule le total du jour', async () => {
    const rice = await add(
      userId,
      REFERENCE_FOODS[0].id,
      200,
      'dejeuner',
    ).expect(201);
    expect(rice.body).toMatchObject({
      budgetCalorique: 1800,
      totalCaloriesKcal: 260,
      totalProteinesG: 5.4,
      totalGlucidesG: 56,
      totalLipidesG: 0.6,
      entrees: [
        {
          foodId: REFERENCE_FOODS[0].id,
          nom: 'Riz blanc cuit',
          quantiteGrammes: 200,
          caloriesKcal: 260,
          proteinesG: 5.4,
          glucidesG: 56,
          lipidesG: 0.6,
          categorieRepas: 'dejeuner',
        },
      ],
    });
    const pasta = await add(userId, REFERENCE_FOODS[1].id, 100).expect(201);
    expect(pasta.body).toMatchObject({
      totalCaloriesKcal: 427,
      totalProteinesG: 11.5,
      totalGlucidesG: 87.4,
      totalLipidesG: 1.7,
    });
    const row = await collection.findOne({ _id: userId });
    expect(row?.journauxAlimentaires).toHaveLength(1);
    expect(row?.journauxAlimentaires[0].entrees).toHaveLength(2);
    expect(row?.journauxAlimentaires[0].entrees[0].aliment).toMatchObject({
      nom: 'Riz blanc cuit',
      caloriesKcalPour100g: 130,
    });
    expect(row?.journauxAlimentaires[0].entrees[0].categorieRepas).toBe(
      'dejeuner',
    );
    expect(row?.journauxAlimentaires[0].entrees[1].categorieRepas).toBe(
      'non-classe',
    );
    expect(row?.journauxAlimentaires[0].totalCaloriesKcal).toBe(427);
    const journal = pasta.body as FoodJournalResponse;
    expect(journal.jourUtc).toBe(
      new Date(journal.entrees[1].receivedAt).toISOString().slice(0, 10),
    );
  });

  it('conserve les deux ajouts simultanés sans perdre de total', async () => {
    const results = await Promise.all([
      add(concurrentUserId, REFERENCE_FOODS[0].id, 200),
      add(concurrentUserId, REFERENCE_FOODS[1].id, 100),
    ]);
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    const row = await collection.findOne({ _id: concurrentUserId });
    expect(row?.version).toBe(2);
    expect(row?.journauxAlimentaires).toHaveLength(1);
    expect(row?.journauxAlimentaires[0].entrees).toHaveLength(2);
    expect(row?.journauxAlimentaires[0].totalCaloriesKcal).toBe(427);
  });

  it('refuse des valeurs nutritionnelles envoyées par le client : elles sont calculées par le serveur', async () => {
    const forged = await request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .auth(token(forgedUserId), { type: 'bearer' })
      .send({
        foodId: REFERENCE_FOODS[0].id,
        quantiteGrammes: 200,
        caloriesKcal: 1,
        proteinesG: 0,
        nom: 'Aliment falsifie',
      })
      .expect(400);
    expect(JSON.stringify(forged.body)).not.toContain('Aliment falsifie');
    const row = await collection.findOne({ _id: forgedUserId });
    expect(row?.journauxAlimentaires).toEqual([]);
    expect(row?.version).toBe(0);
  });

  it('applique un ajout et un retrait simultanés sans perdre ni restaurer d’entrée', async () => {
    const rice = await add(mixedUserId, REFERENCE_FOODS[0].id, 200).expect(201);
    const riceId = (rice.body as { entrees: { id: string }[] }).entrees[0].id;
    const results = await Promise.all([
      add(mixedUserId, REFERENCE_FOODS[1].id, 100),
      request(app.getHttpServer())
        .delete(`/api/food-journals/me/entries/${riceId}`)
        .auth(token(mixedUserId), { type: 'bearer' }),
    ]);
    expect(results.map((result) => result.status)).toEqual([201, 200]);
    const row = await collection.findOne({ _id: mixedUserId });
    expect(row?.version).toBe(3);
    expect(row?.journauxAlimentaires).toHaveLength(1);
    const journal = row?.journauxAlimentaires[0];
    expect(journal?.entrees).toHaveLength(1);
    expect(journal?.entrees[0].aliment.nom).toBe(REFERENCE_FOODS[1].nom);
    expect(journal?.totalCaloriesKcal).toBe(427 - 260);
  });
});
