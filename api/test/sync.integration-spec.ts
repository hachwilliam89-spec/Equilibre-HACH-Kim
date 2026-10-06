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
  mesures: { id: string; source: string; statut: string; jourUtc: string }[];
  journauxAlimentaires: {
    jourUtc: string;
    entrees: { id: string; categorieRepas?: string }[];
    totalCaloriesKcal: number;
  }[];
}

interface UserRow {
  _id: string;
  email: string;
  passwordHash: string;
  role: string;
  favoriteFoodIds?: string[];
}

interface Snapshot {
  curseur: string;
  suiviPoids: { plan: { id: string } } | null;
  mesures: { id: string }[];
  alimentation: {
    budgetCalorique: number;
    journaux: { jourUtc: string; entrees: { id: string }[] }[];
  } | null;
  favoris: { id: string }[];
}

interface PushResult {
  resultats: { id: string; statut: string; code?: string }[];
  instantane: Snapshot;
}

const JOUR_MS = 86_400_000;
const jour = (decalage: number) =>
  new Date(Date.now() - decalage * JOUR_MS).toISOString().slice(0, 10);
/** Midi UTC il y a `decalage` jours, sans jamais dépasser l'instant présent. */
const midi = (decalage: number) => {
  const date = new Date(`${jour(decalage)}T12:00:00.000Z`);
  return new Date(Math.min(date.getTime(), Date.now())).toISOString();
};

describe('Synchronisation BDD embarquée <-> MongoDB (intégration)', () => {
  let app: INestApplication<App>;
  let suivis: Collection<StoredSuivi>;
  let users: Collection<UserRow>;
  const userId = randomUUID();
  const sansPlanId = randomUUID();
  const riz = REFERENCE_FOODS[0].id;
  const pates = REFERENCE_FOODS[1].id;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const connection = app.get<Connection>(getConnectionToken());
    suivis = connection.collection<StoredSuivi>('suivis');
    users = connection.collection<UserRow>('users');
    await users.insertMany(
      [userId, sansPlanId].map((id) => ({
        _id: id,
        email: `${id}@example.test`,
        passwordHash: 'test',
        role: 'utilisateur',
      })),
    );
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
    if (suivis) await suivis.deleteMany({ _id: { $in: [userId] } });
    if (users) await users.deleteMany({ _id: { $in: [userId, sansPlanId] } });
    if (app) await app.close();
  });

  const token = (id: string, role = 'utilisateur') =>
    app.get(JwtService).sign({ sub: id, role });
  const pull = (id: string, curseur?: string) =>
    request(app.getHttpServer())
      .get('/api/sync/me')
      .query(curseur ? { curseur } : {})
      .auth(token(id), { type: 'bearer' });
  const push = (id: string, operations: unknown[]) =>
    request(app.getHttpServer())
      .post('/api/sync/me/operations')
      .auth(token(id), { type: 'bearer' })
      .send({ operations });

  it('protège les routes : connexion requise et rôle utilisateur uniquement', async () => {
    await request(app.getHttpServer()).get('/api/sync/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/sync/me')
      .auth(token(userId, 'coach'), { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/sync/me/operations')
      .auth(token(userId, 'coach'), { type: 'bearer' })
      .send({ operations: [] })
      .expect(403);
  });

  it('renvoie un instantané vide sans plan actif', async () => {
    const { body } = (await pull(sansPlanId).expect(200)) as {
      body: Snapshot;
    };
    expect(body).toMatchObject({
      suiviPoids: null,
      mesures: [],
      alimentation: null,
      favoris: [],
    });
    expect(body.curseur).toMatch(/^[a-f0-9]{32}$/);
  });

  it('pull : renvoie le strict nécessaire, puis 204 si rien n’a changé', async () => {
    const first = (await pull(userId).expect(200)) as { body: Snapshot };
    expect(first.body.alimentation).toMatchObject({
      budgetCalorique: 1800,
      journaux: [],
    });
    expect(first.body.suiviPoids?.plan.id).toBeDefined();
    const unchanged = await pull(userId, first.body.curseur).expect(204);
    expect(unchanged.body).toEqual({});
    expect(unchanged.headers['cache-control']).toBe('no-store');
  });

  it('push : rejoue les modifications hors ligne et renvoie l’instantané à jour', async () => {
    const entreeHier = randomUUID();
    const entreeIlYA3Jours = randomUUID();
    const mesureId = randomUUID();
    const operations = [
      {
        id: randomUUID(),
        type: 'ajout-aliment',
        entreeId: entreeHier,
        foodId: riz,
        quantiteGrammes: 200,
        categorieRepas: 'diner',
        consommeLe: midi(1),
      },
      {
        id: randomUUID(),
        type: 'ajout-aliment',
        entreeId: entreeIlYA3Jours,
        foodId: pates,
        quantiteGrammes: 100,
        consommeLe: midi(3),
      },
      {
        id: randomUUID(),
        type: 'saisie-poids',
        mesureId,
        poidsKg: 79.4,
        saisiLe: new Date().toISOString(),
      },
      { id: randomUUID(), type: 'favori', foodId: pates, favori: true },
    ];

    const { body } = (await push(userId, operations).expect(200)) as {
      body: PushResult;
    };

    expect(body.resultats.map((r) => r.statut)).toEqual([
      'appliquee',
      'appliquee',
      'appliquee',
      'appliquee',
    ]);
    // Le journal d'il y a 3 jours est bien en base mais pas embarqué.
    expect(body.instantane.alimentation?.journaux).toEqual([
      expect.objectContaining({
        jourUtc: jour(1),
        entrees: [expect.objectContaining({ id: entreeHier })],
      }),
    ]);
    expect(body.instantane.mesures).toEqual([
      expect.objectContaining({ id: mesureId }),
    ]);
    expect(body.instantane.favoris).toEqual([
      expect.objectContaining({ id: pates }),
    ]);

    const row = await suivis.findOne({ _id: userId });
    expect(row?.journauxAlimentaires.map((j) => j.jourUtc).sort()).toEqual(
      [jour(3), jour(1)].sort(),
    );
    expect(row?.mesures).toEqual([
      expect.objectContaining({
        id: mesureId,
        source: 'manuelle',
        statut: 'valide',
        jourUtc: jour(0),
      }),
    ]);
    expect((await users.findOne({ _id: userId }))?.favoriteFoodIds).toEqual([
      pates,
    ]);

    // Rejeu du même lot (réponse perdue côté réseau) : aucun doublon.
    const replay = (await push(userId, operations).expect(200)) as {
      body: PushResult;
    };
    expect(replay.body.resultats.map((r) => r.statut)).toEqual([
      'deja-appliquee',
      'deja-appliquee',
      'deja-appliquee',
      'appliquee',
    ]);
    const after = await suivis.findOne({ _id: userId });
    expect(
      after?.journauxAlimentaires.flatMap((j) => j.entrees.map((e) => e.id)),
    ).toHaveLength(2);
    expect(after?.mesures).toHaveLength(1);
  });

  it('push : refuse les opérations hors règles sans bloquer le reste du lot', async () => {
    const entreeDuJour = randomUUID();
    const { body } = (await push(userId, [
      {
        id: randomUUID(),
        type: 'saisie-poids',
        mesureId: randomUUID(),
        poidsKg: 79,
        saisiLe: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        type: 'saisie-poids',
        mesureId: randomUUID(),
        poidsKg: 79,
        saisiLe: midi(1),
      },
      {
        id: randomUUID(),
        type: 'ajout-aliment',
        entreeId: randomUUID(),
        foodId: riz,
        quantiteGrammes: 100,
        consommeLe: midi(10),
      },
      {
        id: randomUUID(),
        type: 'ajout-aliment',
        entreeId: randomUUID(),
        foodId: randomUUID(),
        quantiteGrammes: 100,
        consommeLe: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        type: 'ajout-aliment',
        entreeId: entreeDuJour,
        foodId: riz,
        quantiteGrammes: 100,
        consommeLe: new Date().toISOString(),
      },
      { id: randomUUID(), type: 'retrait-aliment', entreeId: randomUUID() },
    ]).expect(200)) as { body: PushResult };

    expect(body.resultats.map((r) => [r.statut, r.code])).toEqual([
      ['rejetee', 'measurement-day-conflict'],
      ['rejetee', 'saisie-poids-expiree'],
      ['rejetee', 'saisie-trop-ancienne'],
      ['rejetee', 'food-not-found'],
      ['appliquee', undefined],
      ['deja-appliquee', undefined],
    ]);
    const row = await suivis.findOne({ _id: userId });
    expect(row?.mesures).toHaveLength(1);
    expect(
      row?.journauxAlimentaires.find((j) => j.jourUtc === jour(0))?.entrees,
    ).toEqual([expect.objectContaining({ id: entreeDuJour })]);
  });

  it('push : un retrait hors ligne supprime l’entrée et recalcule le total', async () => {
    const entreeId = randomUUID();
    await push(userId, [
      {
        id: randomUUID(),
        type: 'ajout-aliment',
        entreeId,
        foodId: pates,
        quantiteGrammes: 50,
        consommeLe: new Date().toISOString(),
      },
    ]).expect(200);
    const before = await suivis.findOne({ _id: userId });
    const totalAvant = before?.journauxAlimentaires.find(
      (j) => j.jourUtc === jour(0),
    )?.totalCaloriesKcal;

    const { body } = (await push(userId, [
      { id: randomUUID(), type: 'retrait-aliment', entreeId },
    ]).expect(200)) as { body: PushResult };

    expect(body.resultats[0].statut).toBe('appliquee');
    const row = await suivis.findOne({ _id: userId });
    const today = row?.journauxAlimentaires.find((j) => j.jourUtc === jour(0));
    expect(today?.entrees.map((e) => e.id)).not.toContain(entreeId);
    expect(today?.totalCaloriesKcal).toBeLessThan(totalAvant ?? 0);
  });

  it('refuse un lot invalide', async () => {
    await push(userId, []).expect(400);
    await push(userId, [
      { id: randomUUID(), type: 'inconnu', entreeId: randomUUID() },
    ]).expect(400);
    await push(userId, [
      {
        id: randomUUID(),
        type: 'saisie-poids',
        mesureId: randomUUID(),
        poidsKg: -2,
        saisiLe: new Date().toISOString(),
      },
    ]).expect(400);
  });
});
