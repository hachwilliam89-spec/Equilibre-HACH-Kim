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

interface JournalResponse {
  entrees: { id: string; caloriesKcal: number }[];
  totalCaloriesKcal: number;
  totalProteinesG: number;
  totalGlucidesG: number;
  totalLipidesG: number;
}

interface StoredSuivi {
  _id: string;
  journauxAlimentaires: JournalResponse[];
}

describe('Retrait d’une entrée alimentaire (intégration)', () => {
  let app: INestApplication<App>;
  let suivis: MongooseSuiviRepository;
  let collection: Collection<StoredSuivi>;
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
      .collection<StoredSuivi>('suivis');
  });

  afterAll(async () => {
    if (collection && userIds.length) {
      await collection.deleteMany({ _id: { $in: userIds } });
    }
    if (app) await app.close();
  });

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

  const token = (userId: string, role = 'utilisateur') =>
    app.get(JwtService).sign({ sub: userId, role });

  const add = async (userId: string, foodIndex: number, quantity: number) => {
    const response = await request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .auth(token(userId), { type: 'bearer' })
      .send({
        foodId: REFERENCE_FOODS[foodIndex].id,
        quantiteGrammes: quantity,
      })
      .expect(201);
    const journal = response.body as JournalResponse;
    return journal.entrees.at(-1)?.id;
  };

  const remove = (userId: string, entryId: string) =>
    request(app.getHttpServer())
      .delete(`/api/food-journals/me/entries/${entryId}`)
      .auth(token(userId), { type: 'bearer' });

  it('vérifie le rôle, l’UUID et la propriété de l’entrée', async () => {
    const owner = await createUser();
    const other = await createUser();
    const entryId = await add(owner.userId, 0, 200);
    if (!entryId) throw new Error('Entrée créée sans identifiant');

    await request(app.getHttpServer())
      .delete(`/api/food-journals/me/entries/${entryId}`)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/api/food-journals/me/entries/${entryId}`)
      .auth(token(owner.userId, 'coach'), { type: 'bearer' })
      .expect(403);
    await remove(owner.userId, 'invalide').expect(400);
    await remove(other.userId, entryId).expect(404);
    await remove(owner.userId, randomUUID()).expect(404);
    expect(
      (await collection.findOne({ _id: owner.userId }))?.journauxAlimentaires[0]
        .entrees,
    ).toHaveLength(1);
  });

  it('recalcule les totaux après chaque retrait, y compris la dernière entrée', async () => {
    const { userId } = await createUser();
    const riceId = await add(userId, 0, 200);
    const pastaId = await add(userId, 1, 100);
    if (!riceId || !pastaId) throw new Error('Entrée créée sans identifiant');

    const afterRice = (await remove(userId, riceId).expect(200))
      .body as JournalResponse;
    expect(afterRice).toMatchObject({
      totalCaloriesKcal: 167,
      totalProteinesG: 6.1,
      totalGlucidesG: 31.4,
      totalLipidesG: 1.1,
    });
    expect(afterRice.entrees).toHaveLength(1);

    const empty = (await remove(userId, pastaId).expect(200))
      .body as JournalResponse;
    expect(empty).toMatchObject({
      entrees: [],
      totalCaloriesKcal: 0,
      totalProteinesG: 0,
      totalGlucidesG: 0,
      totalLipidesG: 0,
    });
    expect(
      (await collection.findOne({ _id: userId }))?.journauxAlimentaires[0],
    ).toMatchObject(empty);
    await remove(userId, pastaId).expect(404);
  });

  it('permet de corriger un ancien plan terminé', async () => {
    const { userId, plan } = await createUser();
    const entryId = await add(userId, 0, 200);
    if (!entryId) throw new Error('Entrée créée sans identifiant');
    const suivi = await suivis.charger(userId);
    if (!suivi) throw new Error('Suivi introuvable');
    const version = suivi.toProps().version;
    plan.terminate();
    suivi.terminerPlan(plan);
    expect(await suivis.sauvegarderSiVersion(suivi, version)).toBe(true);

    const updated = (await remove(userId, entryId).expect(200))
      .body as JournalResponse;
    expect(updated.entrees).toEqual([]);
  });

  it('conserve les deux retraits simultanés sans restaurer une entrée', async () => {
    const { userId } = await createUser();
    const firstId = await add(userId, 0, 200);
    const secondId = await add(userId, 1, 100);
    if (!firstId || !secondId) throw new Error('Entrée créée sans identifiant');

    const results = await Promise.all([
      remove(userId, firstId),
      remove(userId, secondId),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    const row = await collection.findOne({ _id: userId });
    expect(row?.journauxAlimentaires[0]).toMatchObject({
      entrees: [],
      totalCaloriesKcal: 0,
    });
  });
});
