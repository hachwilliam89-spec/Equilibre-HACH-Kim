import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection, Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { UserDocumentClass } from '../src/auth/infrastructure/persistence/user.schema';
import { Measurement } from '../src/measurements/domain/entities/measurement.entity';
import {
  MEASUREMENT_REPOSITORY,
  type MeasurementRepositoryPort,
} from '../src/measurements/domain/ports/measurement-repository.port';
import { Plan } from '../src/plans/domain/entities/plan.entity';
import {
  PLAN_REPOSITORY,
  type PlanRepositoryPort,
} from '../src/plans/domain/ports/plan-repository.port';
import { MAX_MESURES_SUIVI } from '../src/suivis/domain/entities/suivi.entity';
import { SuiviDocumentClass } from '../src/suivis/infrastructure/persistence/suivi.schema';

describe('Suivi documentaire — API et MongoDB réel', () => {
  let app: INestApplication<App>;
  let suivis: Model<SuiviDocumentClass>;
  let measurements: MeasurementRepositoryPort;
  let plans: PlanRepositoryPort;
  let coachId: string;
  let userId: string;
  let otherUserId: string;
  let activePlan: Plan;
  const userIds: string[] = [];

  const token = (id: string, role = 'utilisateur') =>
    app.get(JwtService).sign({ sub: id, role });
  const auth = (id = userId, role = 'utilisateur') => ({
    Authorization: `Bearer ${token(id, role)}`,
  });
  const postAuto = (poidsKg: number, id = userId) =>
    request(app.getHttpServer())
      .post('/api/measurements')
      .set(auth(id))
      .send({ poidsKg });
  const postCorrection = (poidsKg: number, id = userId) =>
    request(app.getHttpServer())
      .post('/api/measurements/correction')
      .set(auth(id))
      .send({ poidsKg });
  const history = (id = userId) =>
    request(app.getHttpServer()).get('/api/measurements/me').set(auth(id));

  const register = async (role: 'coach' | 'utilisateur', coach?: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        prenom: 'Test',
        nom: 'Equilibre',
        email: `${randomUUID()}@example.test`,
        password: 'password123',
        role,
        coachId: coach,
        tailleCm: 170,
        age: 30,
        sexe: 'femme',
      })
      .expect(201);
    const id = (response.body as { userId: string }).userId;
    userIds.push(id);
    return id;
  };

  const buildPlan = (
    owner = userId,
    overrides: Partial<ReturnType<Plan['toProps']>> = {},
  ) =>
    Plan.restore({
      id: randomUUID(),
      userId: owner,
      coachId,
      poidsDepart: 75,
      poidsCible: 70,
      dateDebut: new Date(Date.now() - 86400000),
      dateCible: new Date(Date.now() + 90 * 86400000),
      imcCible: 24.2,
      niveauActivite: 'actif',
      budgetCalorique: 2000,
      budgetPlafonneAuBmr: false,
      statut: 'actif',
      createdAt: new Date(),
      ...overrides,
    });

  const embeddedMeasurement = (
    planId: string,
    receivedAt: Date,
    overrides: Record<string, unknown> = {},
  ) => ({
    id: randomUUID(),
    userId,
    planId,
    poidsKg: 72,
    receivedAt,
    jourUtc: receivedAt.toISOString().slice(0, 10),
    source: 'automatique',
    statut: 'suspecte',
    ...overrides,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    suivis = app.get<Model<SuiviDocumentClass>>(
      getModelToken(SuiviDocumentClass.name),
    );
    measurements = app.get(MEASUREMENT_REPOSITORY);
    plans = app.get(PLAN_REPOSITORY);
    coachId = await register('coach');
    userId = await register('utilisateur', coachId);
    otherUserId = await register('utilisateur', coachId);
  });

  beforeEach(async () => {
    await suivis.deleteMany({ _id: { $in: userIds } });
    activePlan = buildPlan();
    await plans.create(activePlan);
  });

  afterAll(async () => {
    if (app) {
      await suivis.deleteMany({ _id: { $in: userIds } });
      await app
        .get<Model<UserDocumentClass>>(getModelToken(UserDocumentClass.name))
        .deleteMany({ _id: { $in: userIds } });
      await app.close();
    }
  });

  it('persiste plan et mesure dans un seul document suivis', async () => {
    const response = await postAuto(71.5).expect(201);
    const stored = await suivis.findById(userId).lean();
    expect(stored?.planActif).toMatchObject({ id: activePlan.id });
    expect(stored?.mesures).toHaveLength(1);
    expect(stored?.mesures[0]).toMatchObject({
      id: (response.body as { id: string }).id,
      poidsKg: 71.5,
      source: 'automatique',
      statut: 'valide',
    });
    expect(stored?.derniereMesureValide).toMatchObject({ poidsKg: 71.5 });
    expect(stored?.blocageJournalier).toMatchObject({
      jourUtc: new Date().toISOString().slice(0, 10),
    });
    expect(stored?.version).toBe(1);
  });

  it.each([
    {},
    { poidsKg: 0 },
    { poidsKg: -1 },
    { poidsKg: '72' },
    { poidsKg: null },
    { poidsKg: 72, userId: 'forbidden' },
  ])(
    'rejette un corps invalide sans modifier le suivi : %j',
    async (payload) => {
      const before = await suivis.findById(userId).lean();
      await request(app.getHttpServer())
        .post('/api/measurements')
        .set(auth())
        .send(payload)
        .expect(400);
      const after = await suivis.findById(userId).lean();
      expect(after?.version).toBe(before?.version);
      expect(after?.mesures).toEqual([]);
    },
  );

  it('protège les routes de mesure par authentification et rôle', async () => {
    await request(app.getHttpServer())
      .post('/api/measurements')
      .send({ poidsKg: 72 })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/measurements')
      .set(auth(coachId, 'coach'))
      .send({ poidsKg: 72 })
      .expect(403);
    await request(app.getHttpServer()).get('/api/measurements/me').expect(401);
  });

  it('rejette une mesure sans plan actif sans créer de suivi orphelin', async () => {
    await suivis.deleteOne({ _id: userId });
    await postAuto(72).expect(422);
    expect(await suivis.findById(userId)).toBeNull();
  });

  it('retourne uniquement l’historique personnel par réception décroissante', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    await measurements.create(
      Measurement.create({
        id: randomUUID(),
        userId,
        planId: activePlan.id,
        poidsKg: 72,
        receivedAt: yesterday,
        source: 'automatique',
        statut: 'valide',
      }),
    );
    await measurements.create(
      Measurement.create({
        id: randomUUID(),
        userId,
        planId: activePlan.id,
        poidsKg: 76,
        receivedAt: new Date(),
        source: 'automatique',
        statut: 'suspecte',
      }),
    );
    expect((await history().expect(200)).body).toMatchObject([
      { poidsKg: 76, statut: 'suspecte' },
      { poidsKg: 72, statut: 'valide' },
    ]);
    expect((await history(otherUserId).expect(200)).body).toEqual([]);
  });

  it('masque de l’historique les mesures antérieures à trois mois calendaires', async () => {
    const ancienne = new Date();
    ancienne.setUTCMonth(ancienne.getUTCMonth() - 4);
    await suivis.updateOne(
      { _id: userId },
      {
        $push: {
          mesures: embeddedMeasurement(activePlan.id, ancienne),
        },
      },
    );
    expect((await history().expect(200)).body).toEqual([]);
    expect((await suivis.findById(userId).lean())?.mesures).toHaveLength(1);
  });

  it('refuse une deuxième mesure bloquante du même jour', async () => {
    await postAuto(72).expect(201);
    const conflict = await postAuto(71).expect(409);
    expect(conflict.body).toMatchObject({
      type: 'https://equilibre.app/problems/measurement-day-conflict',
      title: 'Mesure déjà enregistrée aujourd’hui',
    });
    expect((await suivis.findById(userId).lean())?.mesures).toHaveLength(1);
  });

  it('classe suspecte une variation supérieure à 3 kg depuis la veille', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    await measurements.create(
      Measurement.create({
        id: randomUUID(),
        userId,
        planId: activePlan.id,
        poidsKg: 72,
        receivedAt: yesterday,
        source: 'automatique',
        statut: 'valide',
      }),
    );
    expect((await postAuto(76).expect(201)).body).toMatchObject({
      statut: 'suspecte',
    });
  });

  it('autorise une correction après une mesure suspecte puis bloque la suivante', async () => {
    await measurements.create(
      Measurement.create({
        id: randomUUID(),
        userId,
        planId: activePlan.id,
        poidsKg: 90,
        receivedAt: new Date(),
        source: 'automatique',
        statut: 'suspecte',
      }),
    );
    await postCorrection(74).expect(201);
    await postAuto(73).expect(409);
  });

  it('une correction hors-plan bloque également la journée', async () => {
    await suivis.deleteOne({ _id: userId });
    activePlan = buildPlan(userId, {
      dateDebut: new Date(Date.now() + 2 * 86400000),
    });
    await plans.create(activePlan);
    expect((await postCorrection(74).expect(201)).body).toMatchObject({
      statut: 'hors-plan',
    });
    await postAuto(73).expect(409);
  });

  it('arbitre deux écritures simultanées avec une 201 et une 409', async () => {
    const responses = await Promise.all([postAuto(72), postCorrection(71)]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect((await suivis.findById(userId).lean())?.mesures).toHaveLength(1);
  });

  it('retourne le statut de suivi sans charger une autre collection métier', async () => {
    await postAuto(72).expect(201);
    const response = await request(app.getHttpServer())
      .get('/api/measurements/me/suivi')
      .set(auth())
      .expect(200);
    expect(response.body).toMatchObject({
      plan: { id: activePlan.id },
      derniereMesure: { poidsKg: 72 },
    });
  });

  it('termine paresseusement un plan expiré et refuse la mesure', async () => {
    await suivis.deleteOne({ _id: userId });
    activePlan = buildPlan(userId, {
      dateDebut: new Date(Date.now() - 10 * 86400000),
      dateCible: new Date(Date.now() - 86400000),
    });
    await plans.create(activePlan);
    await postAuto(72).expect(422);
    const stored = await suivis.findById(userId).lean();
    expect(stored?.planActif).toBeNull();
    expect(stored?.plans).toEqual([]);
  });

  it('refuse la 1001e mesure récente avec 429 sans modifier le document', async () => {
    const now = new Date();
    const seeded = Array.from({ length: MAX_MESURES_SUIVI }, (_, index) =>
      embeddedMeasurement(activePlan.id, now, {
        id: `${index}-${randomUUID()}`,
      }),
    );
    await suivis.updateOne({ _id: userId }, { $set: { mesures: seeded } });
    const before = await suivis.findById(userId).lean();
    const response = await postAuto(72).expect(429);
    expect(response.body).toMatchObject({
      type: 'https://equilibre.app/problems/measurement-history-limit',
    });
    const after = await suivis.findById(userId).lean();
    expect(after?.version).toBe(before?.version);
    expect(after?.mesures).toHaveLength(MAX_MESURES_SUIVI);
  });

  it('stocke le profil dans users.profil et n’enregistre que les trois modèles racines', async () => {
    const user = await app
      .get<Model<UserDocumentClass>>(getModelToken(UserDocumentClass.name))
      .findById(userId)
      .lean();
    expect(user?.profil).toMatchObject({
      tailleCm: 170,
      age: 30,
      sexe: 'femme',
    });
    expect(user).not.toHaveProperty('tailleCm');
    const modelNames = app.get<Connection>(getConnectionToken()).modelNames();
    expect(modelNames).toContain(SuiviDocumentClass.name);
    expect(modelNames).not.toContain('PlanDocumentClass');
    expect(modelNames).not.toContain('MeasurementDocumentClass');
  });
});
