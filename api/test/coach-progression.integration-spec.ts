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

interface OverviewRow {
  id: string;
  email: string;
  prenom?: string;
  nom?: string;
  derniereActivite: string | null;
  suiviPoids: {
    statut: string;
    derniereMesure: { poidsKg: number } | null;
  } | null;
  alimentation: { statut: string; ecartKcal: number | null } | null;
}

interface ProgressionBody {
  utilisateur: { id: string; email: string };
  suiviPoids: { statut: string; plan: { id: string } } | null;
  mesures: { poidsKg: number }[];
  alimentation: {
    statut: string;
    budgetCalorique: number;
    jours: {
      jourUtc: string;
      totalCaloriesKcal: number;
      nombreEntrees: number;
      statut: string;
    }[];
  } | null;
}

describe('Progression des utilisateurs côté coach (intégration)', () => {
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

  const token = (id: string, role: string) =>
    app.get(JwtService).sign({ sub: id, role });

  const register = async (role: 'coach' | 'utilisateur', coachId?: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        prenom: 'Test',
        nom: 'Equilibre',
        email: `${randomUUID()}@example.test`,
        password: 'password123',
        role,
        coachId,
        tailleCm: 175,
      })
      .expect(201);
    const userId = (response.body as { userId: string }).userId;
    if (role === 'utilisateur') userIds.push(userId);
    return userId;
  };

  /** Plan actif démarré il y a 10 jours, 80 → 75 kg, budget 1800 kcal. */
  async function activatePlan(userId: string, coachId: string) {
    const debut = new Date(Date.now() - 10 * 86_400_000);
    debut.setUTCHours(0, 0, 0, 0);
    const plan = Plan.restore({
      id: randomUUID(),
      userId,
      coachId,
      poidsDepart: 80,
      poidsCible: 75,
      dateDebut: debut,
      dateCible: new Date('2099-12-31T00:00:00Z'),
      imcCible: 24.5,
      niveauActivite: 'actif',
      budgetCalorique: 1800,
      budgetPlafonneAuBmr: false,
      statut: 'actif',
      createdAt: debut,
    });
    const suivi = Suivi.create(userId);
    suivi.activerPlan(plan);
    expect(await suivis.creer(suivi)).toBe(true);
    return plan;
  }

  const overview = (coachId: string, role = 'coach') =>
    request(app.getHttpServer())
      .get('/api/coach/clients')
      .auth(token(coachId, role), { type: 'bearer' });

  const detail = (coachId: string, userId: string, role = 'coach') =>
    request(app.getHttpServer())
      .get(`/api/coach/clients/${userId}`)
      .auth(token(coachId, role), { type: 'bearer' });

  it('formate aussi une route inconnue avec le filtre global', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/route-inexistante')
      .expect(404);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 404,
      detail: 'Route API introuvable',
      instance: '/api/route-inexistante',
    });
  });

  it('réserve les routes au coach authentifié', async () => {
    const coach = await register('coach');
    const user = await register('utilisateur', coach);
    const unauthorized = await request(app.getHttpServer())
      .get('/api/coach/clients')
      .expect(401);
    expect(unauthorized.body).toMatchObject({
      title: 'Non autorise',
      detail: 'Non autorise',
    });
    await request(app.getHttpServer())
      .get(`/api/coach/clients/${user}`)
      .expect(401);
    await overview(user, 'utilisateur').expect(403);
    await detail(user, user, 'utilisateur').expect(403);
  });

  it('liste uniquement ses utilisateurs avec leurs statuts poids et alimentation', async () => {
    const coach = await register('coach');
    const otherCoach = await register('coach');
    const followed = await register('utilisateur', coach);
    const withoutPlan = await register('utilisateur', coach);
    await register('utilisateur', otherCoach);
    await activatePlan(followed, coach);

    await request(app.getHttpServer())
      .post('/api/measurements')
      .auth(token(followed, 'utilisateur'), { type: 'bearer' })
      .send({ poidsKg: 79.2 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .auth(token(followed, 'utilisateur'), { type: 'bearer' })
      .send({ foodId: REFERENCE_FOODS[0].id, quantiteGrammes: 200 })
      .expect(201);

    const avantLecture = Date.now();
    const rows = (await overview(coach).expect(200)).body as OverviewRow[];
    expect(rows.map((row) => row.id).sort()).toEqual(
      [followed, withoutPlan].sort(),
    );
    const suivi = rows.find((row) => row.id === followed);
    expect(suivi?.suiviPoids?.derniereMesure?.poidsKg).toBe(79.2);
    expect(suivi?.suiviPoids?.statut).toBe('dans-les-clous');
    expect(suivi?.alimentation).toEqual({
      statut: 'dans-le-budget',
      ecartKcal: -1540,
    });
    // Derniere activite : la saisie alimentaire, posterieure a la pesee.
    expect(suivi?.prenom).toBe('Test');
    expect(suivi?.derniereActivite).not.toBeNull();
    const activite = Date.parse(suivi?.derniereActivite ?? '');
    expect(activite).toBeLessThanOrEqual(avantLecture);
    expect(avantLecture - activite).toBeLessThan(60_000);
    const sansPlan = rows.find((row) => row.id === withoutPlan);
    expect(sansPlan).toMatchObject({
      suiviPoids: null,
      alimentation: null,
      derniereActivite: null,
    });
  });

  it('donne la fiche d’un utilisateur rattaché : 7 jours de totaux, sans aliments', async () => {
    const coach = await register('coach');
    const user = await register('utilisateur', coach);
    const plan = await activatePlan(user, coach);
    await request(app.getHttpServer())
      .post('/api/measurements')
      .auth(token(user, 'utilisateur'), { type: 'bearer' })
      .send({ poidsKg: 79.4 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/food-journals/me/entries')
      .auth(token(user, 'utilisateur'), { type: 'bearer' })
      .send({ foodId: REFERENCE_FOODS[0].id, quantiteGrammes: 200 })
      .expect(201);

    const response = await detail(coach, user).expect(200);
    const body = response.body as ProgressionBody;
    expect(body.utilisateur.id).toBe(user);
    expect(body.suiviPoids?.plan.id).toBe(plan.id);
    expect(body.mesures.map((m) => m.poidsKg)).toEqual([79.4]);
    expect(body.alimentation?.budgetCalorique).toBe(1800);
    expect(body.alimentation?.jours).toHaveLength(7);
    const today = new Date().toISOString().slice(0, 10);
    expect(body.alimentation?.jours[6]).toMatchObject({
      jourUtc: today,
      totalCaloriesKcal: 260,
      nombreEntrees: 1,
      statut: 'dans-le-budget',
    });
    expect(body.alimentation?.jours[0]).toMatchObject({
      totalCaloriesKcal: 0,
      statut: 'aucune-entree',
    });
    // Confidentialité : le coach ne reçoit que des totaux.
    expect(response.text).not.toContain(REFERENCE_FOODS[0].nom);
    expect(response.text).not.toContain('entrees');
  });

  it('renvoie une fiche vide sans plan et refuse l’utilisateur d’un autre coach', async () => {
    const coach = await register('coach');
    const otherCoach = await register('coach');
    const user = await register('utilisateur', coach);
    const body = (await detail(coach, user).expect(200))
      .body as ProgressionBody;
    expect(body).toMatchObject({
      suiviPoids: null,
      mesures: [],
      alimentation: null,
    });
    await detail(otherCoach, user).expect(403);
    await detail(coach, randomUUID()).expect(403);
  });
});
