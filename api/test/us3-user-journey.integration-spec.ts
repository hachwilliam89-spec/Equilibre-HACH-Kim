import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Plan } from '../src/plans/domain/entities/plan.entity';
import { Suivi } from '../src/suivis/domain/entities/suivi.entity';
import { MongooseSuiviRepository } from '../src/suivis/infrastructure/persistence/mongoose-suivi.repository';

describe('US3 — parcours alimentaire complet (intégration)', () => {
  let app: INestApplication<App>;
  let collection: Collection<{ _id: string }>;
  const userId = randomUUID();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    collection = app.get<Connection>(getConnectionToken()).collection('suivis');

    const suivi = Suivi.create(userId);
    suivi.activerPlan(
      Plan.restore({
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
      }),
    );
    expect(await app.get(MongooseSuiviRepository).creer(suivi)).toBe(true);
  });

  afterAll(async () => {
    if (collection) await collection.deleteOne({ _id: userId });
    if (app) await app.close();
  });

  it('cherche, consigne, consulte et retire un aliment avec le même compte', async () => {
    const token = app
      .get(JwtService)
      .sign({ sub: userId, role: 'utilisateur' });
    const api = request(app.getHttpServer());

    const search = await api
      .get('/api/foods')
      .query({ q: 'riz' })
      .auth(token, { type: 'bearer' })
      .expect(200);
    const [rice] = search.body as { id: string; nom: string }[];
    expect(rice?.nom).toBe('Riz blanc cuit');

    const added = await api
      .post('/api/food-journals/me/entries')
      .auth(token, { type: 'bearer' })
      .send({ foodId: rice.id, quantiteGrammes: 200 })
      .expect(201);
    const created = added.body as {
      totalCaloriesKcal: number;
      entrees: { id: string; caloriesKcal: number }[];
    };
    expect(created.totalCaloriesKcal).toBe(260);
    expect(created.entrees[0].caloriesKcal).toBe(260);

    const status = await api
      .get('/api/food-journals/me/status')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(status.body).toMatchObject({
      statut: 'dans-le-budget',
      ecartKcal: -1540,
      journal: { totalCaloriesKcal: 260 },
    });

    const removed = await api
      .delete(`/api/food-journals/me/entries/${created.entrees[0].id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(removed.body).toMatchObject({ entrees: [], totalCaloriesKcal: 0 });

    const empty = await api
      .get('/api/food-journals/me/status')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(empty.body).toMatchObject({
      statut: 'pas-de-donnees-recentes',
      ecartKcal: null,
    });
  });
});
