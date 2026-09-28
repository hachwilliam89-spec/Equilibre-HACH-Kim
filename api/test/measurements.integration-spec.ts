import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  Measurement,
  MeasurementProps,
} from '../src/measurements/domain/entities/measurement.entity';
import {
  MEASUREMENT_REPOSITORY,
  MeasurementRepositoryPort,
} from '../src/measurements/domain/ports/measurement-repository.port';
import { MeasurementDocumentClass } from '../src/measurements/infrastructure/persistence/measurement.schema';
import { UserDocumentClass } from '../src/auth/infrastructure/persistence/user.schema';
import { PlanDocumentClass } from '../src/plans/infrastructure/persistence/plan.schema';

describe('Mesures — réception et historique (MongoDB réel)', () => {
  let app: INestApplication<App>;
  let repository: MeasurementRepositoryPort;
  let model: Model<MeasurementDocumentClass>;
  const users: string[] = [];
  const plans: string[] = [];
  let coach: string;
  let owner: string;
  let other: string;
  let activePlan: string;
  let oldPlan: string;
  let otherPlan: string;

  const token = (id: string, role = 'utilisateur') =>
    app.get(JwtService).sign({ sub: id, role });
  const get = (id: string, query = '') =>
    request(app.getHttpServer())
      .get(`/api/measurements/me${query}`)
      .auth(token(id), { type: 'bearer' });
  const register = async (role: string, coachId?: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `${randomUUID()}@example.test`,
        password: 'password123',
        role,
        coachId,
        tailleCm: 170,
      })
      .expect(201);
    const id = (response.body as { userId: string }).userId;
    users.push(id);
    return id;
  };
  const createPlan = async (userId: string, statut: 'actif' | 'termine') => {
    const id = randomUUID();
    await app
      .get<Model<PlanDocumentClass>>(getModelToken(PlanDocumentClass.name))
      .create({
        _id: id,
        userId,
        coachId: coach,
        poidsDepart: 75,
        poidsCible: 70,
        dateDebut: new Date(Date.now() - 86400000),
        dateCible: new Date(Date.now() + 30 * 86400000),
        imcCible: 24.2,
        niveauActivite: 'actif',
        budgetCalorique: 2000,
        budgetPlafonneAuBmr: false,
        statut,
      });
    plans.push(id);
    return id;
  };
  const measure = (overrides: Partial<MeasurementProps> = {}) =>
    Measurement.create({
      id: randomUUID(),
      userId: owner,
      planId: activePlan,
      poidsKg: 72,
      receivedAt: new Date('2026-09-24T10:00:00Z'),
      source: 'automatique',
      statut: 'valide',
      ...overrides,
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    repository = app.get<MeasurementRepositoryPort>(MEASUREMENT_REPOSITORY);
    model = app.get<Model<MeasurementDocumentClass>>(
      getModelToken(MeasurementDocumentClass.name),
    );
    coach = await register('coach');
    owner = await register('utilisateur', coach);
    other = await register('utilisateur', coach);
    activePlan = await createPlan(owner, 'actif');
    oldPlan = await createPlan(owner, 'termine');
    otherPlan = await createPlan(other, 'actif');
  });

  afterEach(async () => {
    if (model) await model.deleteMany({ userId: { $in: users } });
  });
  afterAll(async () => {
    if (app) {
      await app
        .get<Model<PlanDocumentClass>>(getModelToken(PlanDocumentClass.name))
        .deleteMany({ _id: { $in: plans } });
      await app
        .get<Model<UserDocumentClass>>(getModelToken(UserDocumentClass.name))
        .deleteMany({ _id: { $in: users } });
      await app.close();
    }
  });

  describe('FR403-669 — réception automatique', () => {
    const post = (payload: object) =>
      request(app.getHttpServer())
        .post('/api/measurements')
        .auth(token(owner), { type: 'bearer' })
        .send(payload);

    it('persiste le poids, le propriétaire JWT, le plan actif et la date serveur UTC', async () => {
      const before = Date.now();
      const response = await post({ poidsKg: 71.5 }).expect(201);
      const after = Date.now();
      const body = response.body as MeasurementProps & { receivedAt: string };
      expect(body).toMatchObject({
        userId: owner,
        planId: activePlan,
        poidsKg: 71.5,
        source: 'automatique',
        statut: 'valide',
      });
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      const received = new Date(body.receivedAt);
      expect(received.getTime()).toBeGreaterThanOrEqual(before);
      expect(received.getTime()).toBeLessThanOrEqual(after);
      expect(body.jourUtc).toBe(received.toISOString().slice(0, 10));
      const stored = await model.findById(body.id).lean();
      expect(stored).toMatchObject({
        userId: owner,
        planId: activePlan,
        poidsKg: 71.5,
        receivedAt: received,
        jourUtc: body.jourUtc,
        source: 'automatique',
      });
      expect((await get(owner).expect(200)).body).toEqual([body]);
      expect((await get(other).expect(200)).body).toEqual([]);
    });

    it.each([
      {},
      { poidsKg: 0 },
      { poidsKg: -1 },
      { poidsKg: '72' },
      { poidsKg: null },
      { poidsKg: 72, userId: 'autre' },
      { poidsKg: 72, planId: 'autre' },
      { poidsKg: 72, receivedAt: '2020-01-01' },
      { poidsKg: 72, jourUtc: '2020-01-01' },
      { poidsKg: 72, source: 'manuelle' },
      { poidsKg: 72, statut: 'valide' },
    ])('rejette un corps invalide sans enregistrer : %j', async (payload) => {
      await post(payload).expect(400);
      expect(await model.countDocuments({ userId: owner })).toBe(0);
    });

    it('protège explicitement la nouvelle route contre anonyme, JWT invalide et coach', async () => {
      await request(app.getHttpServer())
        .post('/api/measurements')
        .send({ poidsKg: 72 })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/measurements')
        .auth('invalid', { type: 'bearer' })
        .send({ poidsKg: 72 })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/measurements')
        .auth(token(coach, 'coach'), { type: 'bearer' })
        .send({ poidsKg: 72 })
        .expect(403);
      expect(await model.countDocuments({ userId: { $in: users } })).toBe(0);
    });

    it.each(['sans-plan', 'annule', 'termine', 'expire'])(
      'rejette le cas %s sans mesure orpheline',
      async (state) => {
        const planModel = app.get<Model<PlanDocumentClass>>(
          getModelToken(PlanDocumentClass.name),
        );
        const original = await planModel.findById(activePlan).lean();
        try {
          if (state === 'sans-plan')
            await planModel.deleteOne({ _id: activePlan });
          else
            await planModel.updateOne(
              { _id: activePlan },
              {
                $set:
                  state === 'expire'
                    ? { dateCible: new Date(Date.now() - 2 * 86400000) }
                    : { statut: state },
              },
            );
          const response = await post({ poidsKg: 72 }).expect(422);
          expect(response.body).toMatchObject({
            status: 422,
            type: 'https://equilibre.app/problems/no-active-plan',
          });
          expect(await model.countDocuments({ userId: owner })).toBe(0);
          if (state === 'expire')
            expect((await planModel.findById(activePlan))?.statut).toBe(
              'termine',
            );
        } finally {
          await planModel.replaceOne({ _id: activePlan }, original!, {
            upsert: true,
          });
        }
      },
    );
  });

  it('refuse explicitement les accès anonyme, JWT invalide et coach', async () => {
    await request(app.getHttpServer()).get('/api/measurements/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/measurements/me')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/measurements/me')
      .auth(token(coach, 'coach'), { type: 'bearer' })
      .expect(403);
  });

  it('renvoie une liste vide sans mesure', async () => {
    expect((await get(owner).expect(200)).body).toEqual([]);
  });

  it('retourne tous les statuts et sources, anciens plans inclus, triés et isolés par JWT', async () => {
    const oldest = measure({
      planId: oldPlan,
      receivedAt: new Date('2026-08-01T10:00:00Z'),
    });
    const suspect = measure({
      statut: 'suspecte',
      receivedAt: new Date('2026-09-24T08:00:00Z'),
    });
    const correction = measure({ source: 'manuelle' });
    const outside = measure({
      statut: 'hors-plan',
      source: 'manuelle',
      receivedAt: new Date('2026-09-25T00:00:00Z'),
    });
    for (const measurement of [
      correction,
      oldest,
      outside,
      suspect,
      measure({ userId: other, planId: otherPlan }),
    ]) {
      await repository.create(measurement);
    }
    const response = await get(
      owner,
      `?userId=${other}&planId=${otherPlan}`,
    ).expect(200);
    expect(response.body).toEqual(
      [outside, correction, suspect, oldest].map((measurement) => {
        const props = measurement.toProps();
        return { ...props, receivedAt: props.receivedAt.toISOString() };
      }),
    );
    expect((await get(other).expect(200)).body).toHaveLength(1);
    await request(app.getHttpServer())
      .get(`/api/measurements/users/${other}`)
      .auth(token(owner), { type: 'bearer' })
      .expect(404);
  });

  it('arbitre deux insertions valides simultanées, automatique et manuelle, sans supprimer les autres statuts', async () => {
    const results = await Promise.allSettled([
      repository.create(measure()),
      repository.create(measure({ source: 'manuelle' })),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
    await repository.create(measure({ statut: 'suspecte' }));
    await repository.create(measure({ statut: 'hors-plan' }));
    expect(
      await model.countDocuments({ userId: owner, statut: 'valide' }),
    ).toBe(1);
    expect(await model.countDocuments({ userId: owner })).toBe(3);
  });

  it('impose les références, poids positifs et identifiants uniques dans la persistance', async () => {
    const measurement = measure();
    await repository.create(measurement);
    await expect(repository.create(measurement)).rejects.toMatchObject({
      status: 409,
    });
    const { id, ...props } = measure().toProps();
    for (const invalid of [
      { userId: '' },
      { planId: '' },
      { poidsKg: 0 },
      { poidsKg: -1 },
      { poidsKg: Infinity },
    ]) {
      await expect(
        model.create({ _id: id, ...props, ...invalid }),
      ).rejects.toThrow();
    }
  });

  describe('FR403-674 — blocage des doublons du jour', () => {
    const post = (payload: object) =>
      request(app.getHttpServer())
        .post('/api/measurements')
        .auth(token(owner), { type: 'bearer' })
        .send(payload);

    it('refuse une deuxième mesure valide le même jour avec un 409 explicite', async () => {
      await post({ poidsKg: 71.5 }).expect(201);
      const conflict = await post({ poidsKg: 70.2 }).expect(409);
      expect(conflict.body).toMatchObject({
        status: 409,
        type: 'https://equilibre.app/problems/measurement-day-conflict',
      });
      const stored = await model.find({ userId: owner }).lean();
      expect(stored).toHaveLength(1);
      expect(stored[0].poidsKg).toBe(71.5);
    });

    it("accepte une mesure quand la seule mesure valide date d'un autre jour", async () => {
      await repository.create(
        measure({ receivedAt: new Date(Date.now() - 86400000) }),
      );
      await post({ poidsKg: 71.5 }).expect(201);
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(2);
    });

    it("n'oppose pas le blocage à une mesure suspecte ou hors-plan du même jour", async () => {
      await repository.create(
        measure({ statut: 'suspecte', receivedAt: new Date() }),
      );
      await repository.create(
        measure({
          statut: 'hors-plan',
          source: 'manuelle',
          receivedAt: new Date(),
        }),
      );
      await post({ poidsKg: 71.5 }).expect(201);
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
      expect(await model.countDocuments({ userId: owner })).toBe(3);
    });

    it('arbitre deux réceptions simultanées le même jour : une 201, une 409', async () => {
      const responses = await Promise.all([
        post({ poidsKg: 71.5 }),
        post({ poidsKg: 70.9 }),
      ]);
      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      const conflict = responses.find((res) => res.status === 409)!;
      expect(conflict.body).toMatchObject({
        status: 409,
        type: 'https://equilibre.app/problems/measurement-day-conflict',
      });
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
    });
  });
});
