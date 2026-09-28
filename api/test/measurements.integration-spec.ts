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

  describe('FR403-672 — classification suspecte / hors-plan', () => {
    const post = (payload: object) =>
      request(app.getHttpServer())
        .post('/api/measurements')
        .auth(token(owner), { type: 'bearer' })
        .send(payload);
    const hier = () => new Date(Date.now() - 86400000);
    const planModel = () =>
      app.get<Model<PlanDocumentClass>>(getModelToken(PlanDocumentClass.name));

    it('classe suspecte un ecart superieur a 3 kg avec la veille du meme plan', async () => {
      await repository.create(measure({ receivedAt: hier(), poidsKg: 72 }));
      const response = await post({ poidsKg: 76 }).expect(201);
      expect((response.body as MeasurementProps).statut).toBe('suspecte');
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
    });

    it('garde valide un ecart inferieur ou egal a 3 kg avec la veille', async () => {
      await repository.create(measure({ receivedAt: hier(), poidsKg: 72 }));
      const response = await post({ poidsKg: 74 }).expect(201);
      expect((response.body as MeasurementProps).statut).toBe('valide');
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(2);
    });

    it('ignore la veille d un autre plan pour le controle suspect', async () => {
      await repository.create(
        measure({ planId: oldPlan, receivedAt: hier(), poidsKg: 60 }),
      );
      const response = await post({ poidsKg: 76 }).expect(201);
      expect((response.body as MeasurementProps).statut).toBe('valide');
    });

    it('classe hors-plan une mesure anterieure au debut du plan actif', async () => {
      const original = await planModel().findById(activePlan).lean();
      try {
        await planModel().updateOne(
          { _id: activePlan },
          { $set: { dateDebut: new Date(Date.now() + 3 * 86400000) } },
        );
        const response = await post({ poidsKg: 71.5 }).expect(201);
        expect((response.body as MeasurementProps).statut).toBe('hors-plan');
        expect(
          await model.countDocuments({ userId: owner, statut: 'valide' }),
        ).toBe(0);
        expect(await model.countDocuments({ userId: owner })).toBe(1);
      } finally {
        await planModel().replaceOne({ _id: activePlan }, original!, {
          upsert: true,
        });
      }
    });
  });

  describe('FR403-675 — affichage du statut de suivi', () => {
    interface SuiviBody {
      statut: string;
      plan: { id: string; poidsDepart: number; poidsCible: number };
      derniereMesure: { poidsKg: number; statut: string } | null;
      poidsAttendu: number | null;
      ecartKg: number | null;
    }
    const post = (payload: object) =>
      request(app.getHttpServer())
        .post('/api/measurements')
        .auth(token(owner), { type: 'bearer' })
        .send(payload);
    const getSuivi = (id: string = owner) =>
      request(app.getHttpServer())
        .get('/api/measurements/me/suivi')
        .auth(token(id), { type: 'bearer' });

    it('est en attente de premiere mesure quand aucune mesure valide', async () => {
      const body = (await getSuivi().expect(200)).body as SuiviBody;
      expect(body.statut).toBe('en-attente-premiere-mesure');
      expect(body.plan.id).toBe(activePlan);
      expect(body.plan.poidsCible).toBe(70);
      expect(body.derniereMesure).toBeNull();
      expect(body.poidsAttendu).toBeNull();
      expect(body.ecartKg).toBeNull();
    });

    it('est dans les clous quand la derniere mesure suit la trajectoire', async () => {
      await post({ poidsKg: 75 }).expect(201);
      const body = (await getSuivi().expect(200)).body as SuiviBody;
      expect(body.statut).toBe('dans-les-clous');
      expect(body.derniereMesure?.poidsKg).toBe(75);
      expect(body.poidsAttendu).not.toBeNull();
      expect(Math.abs(body.ecartKg as number)).toBeLessThanOrEqual(1);
    });

    it('detecte un ecart quand la derniere mesure sort de la tolerance', async () => {
      await post({ poidsKg: 80 }).expect(201);
      const body = (await getSuivi().expect(200)).body as SuiviBody;
      expect(body.statut).toBe('ecart-detecte');
      expect(Math.abs(body.ecartKg as number)).toBeGreaterThan(1);
    });

    it('signale pas de donnees recentes au-dela d un jour', async () => {
      await repository.create(
        measure({ receivedAt: new Date(Date.now() - 2 * 86400000) }),
      );
      const body = (await getSuivi().expect(200)).body as SuiviBody;
      expect(body.statut).toBe('pas-de-donnees-recentes');
      expect(body.derniereMesure).not.toBeNull();
      expect(body.poidsAttendu).toBeNull();
      expect(body.ecartKg).toBeNull();
    });

    it('ignore les mesures suspecte et hors-plan pour le statut', async () => {
      await repository.create(
        measure({ statut: 'suspecte', receivedAt: new Date() }),
      );
      await repository.create(
        measure({ statut: 'hors-plan', receivedAt: new Date() }),
      );
      const body = (await getSuivi().expect(200)).body as SuiviBody;
      expect(body.statut).toBe('en-attente-premiere-mesure');
    });

    it('retourne 200 null quand l utilisateur n a aucun plan actif', async () => {
      const sansPlan = await register('utilisateur', coach);
      const response = await getSuivi(sansPlan).expect(200);
      expect(response.body).toBeNull();
    });

    it('protege la route contre anonyme, JWT invalide et coach', async () => {
      await request(app.getHttpServer())
        .get('/api/measurements/me/suivi')
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/measurements/me/suivi')
        .auth('invalid', { type: 'bearer' })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/measurements/me/suivi')
        .auth(token(coach, 'coach'), { type: 'bearer' })
        .expect(403);
    });
  });

  describe('FR403-670 — correction manuelle en secours', () => {
    const postCorrection = (payload: object, id: string = owner) =>
      request(app.getHttpServer())
        .post('/api/measurements/correction')
        .auth(token(id), { type: 'bearer' })
        .send(payload);
    const postAuto = (payload: object) =>
      request(app.getHttpServer())
        .post('/api/measurements')
        .auth(token(owner), { type: 'bearer' })
        .send(payload);
    const planModel = () =>
      app.get<Model<PlanDocumentClass>>(getModelToken(PlanDocumentClass.name));

    it('enregistre une correction valide quand aucune mesure du jour', async () => {
      const response = await postCorrection({ poidsKg: 74 }).expect(201);
      const body = response.body as MeasurementProps;
      expect(body.source).toBe('manuelle');
      expect(body.statut).toBe('valide');
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
    });

    it('autorise la correction quand la mesure du jour est suspecte', async () => {
      await repository.create(
        measure({ statut: 'suspecte', receivedAt: new Date() }),
      );
      const body = (await postCorrection({ poidsKg: 74 }).expect(201))
        .body as MeasurementProps;
      expect(body.statut).toBe('valide');
      expect(body.source).toBe('manuelle');
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
      expect(await model.countDocuments({ userId: owner })).toBe(2);
    });

    it('refuse une correction quand une mesure auto valide existe deja ce jour', async () => {
      await postAuto({ poidsKg: 74 }).expect(201);
      const conflict = await postCorrection({ poidsKg: 73 }).expect(409);
      expect(conflict.body).toMatchObject({
        status: 409,
        type: 'https://equilibre.app/problems/measurement-day-conflict',
      });
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
    });

    it('refuse une deuxieme correction manuelle le meme jour', async () => {
      await postCorrection({ poidsKg: 74 }).expect(201);
      await postCorrection({ poidsKg: 73 }).expect(409);
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
    });

    it('classe hors-plan une correction hors periode sans la retenir', async () => {
      const original = await planModel().findById(activePlan).lean();
      try {
        await planModel().updateOne(
          { _id: activePlan },
          { $set: { dateDebut: new Date(Date.now() + 3 * 86400000) } },
        );
        const body = (await postCorrection({ poidsKg: 74 }).expect(201))
          .body as MeasurementProps;
        expect(body.statut).toBe('hors-plan');
        expect(body.source).toBe('manuelle');
        expect(
          await model.countDocuments({ userId: owner, statut: 'valide' }),
        ).toBe(0);
      } finally {
        await planModel().replaceOne({ _id: activePlan }, original!, {
          upsert: true,
        });
      }
    });

    it('rejette la correction sans plan actif', async () => {
      const sansPlan = await register('utilisateur', coach);
      const response = await postCorrection({ poidsKg: 74 }, sansPlan).expect(
        422,
      );
      expect(response.body).toMatchObject({
        type: 'https://equilibre.app/problems/no-active-plan',
      });
    });

    it('protege la route et valide le corps', async () => {
      await request(app.getHttpServer())
        .post('/api/measurements/correction')
        .send({ poidsKg: 74 })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/measurements/correction')
        .auth('invalid', { type: 'bearer' })
        .send({ poidsKg: 74 })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/measurements/correction')
        .auth(token(coach, 'coach'), { type: 'bearer' })
        .send({ poidsKg: 74 })
        .expect(403);
      await postCorrection({ poidsKg: 0 }).expect(400);
      await postCorrection({ poidsKg: 74, source: 'manuelle' }).expect(400);
    });
  });

  describe('FR403-676 — concurrence sur les mesures valides du jour', () => {
    const postAuto = (payload: object) =>
      request(app.getHttpServer())
        .post('/api/measurements')
        .auth(token(owner), { type: 'bearer' })
        .send(payload);
    const postCorrection = (payload: object) =>
      request(app.getHttpServer())
        .post('/api/measurements/correction')
        .auth(token(owner), { type: 'bearer' })
        .send(payload);
    const attenduUneSeuleValide = async (
      responses: { status: number; body: unknown }[],
    ) => {
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      const conflict = responses.find((r) => r.status === 409)!;
      expect(conflict.body).toMatchObject({
        status: 409,
        type: 'https://equilibre.app/problems/measurement-day-conflict',
      });
      expect(
        await model.countDocuments({ userId: owner, statut: 'valide' }),
      ).toBe(1);
    };

    it('arbitre deux corrections manuelles simultanees', async () => {
      const responses = await Promise.all([
        postCorrection({ poidsKg: 74 }),
        postCorrection({ poidsKg: 73 }),
      ]);
      await attenduUneSeuleValide(responses);
    });

    it('arbitre une reception automatique et une correction simultanees', async () => {
      const responses = await Promise.all([
        postAuto({ poidsKg: 74 }),
        postCorrection({ poidsKg: 73 }),
      ]);
      await attenduUneSeuleValide(responses);
    });
  });
});
