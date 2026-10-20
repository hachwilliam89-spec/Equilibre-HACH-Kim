import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MongooseSuiviRepository } from '../src/suivis/infrastructure/persistence/mongoose-suivi.repository';

interface StoredSuivi {
  _id: string;
  planActif: unknown;
  pasQuotidiens?: { jourUtc: string; nombrePas: number }[];
}

interface ActiviteBody {
  historique: { jourUtc: string; nombrePas: number }[];
  moyenne7Jours: {
    joursRenseignes: number;
    moyennePas: number | null;
    niveau: string | null;
  };
}

const jourUtc = (decalage: number) =>
  new Date(Date.now() - decalage * 86_400_000).toISOString().slice(0, 10);

describe('Suivi de l’activité physique (intégration, US4)', () => {
  let app: INestApplication<App>;
  let suivis: Collection<StoredSuivi>;
  let users: Collection<{ _id: string }>;
  let coachId: string;
  let userId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const connection = app.get<Connection>(getConnectionToken());
    suivis = connection.collection<StoredSuivi>('suivis');
    users = connection.collection<{ _id: string }>('users');

    coachId = await register('coach');
    userId = await register('utilisateur', coachId);
  });

  afterAll(async () => {
    if (suivis) await suivis.deleteMany({ _id: { $in: [userId] } });
    if (users) await users.deleteMany({ _id: { $in: [userId, coachId] } });
    if (app) await app.close();
  });

  async function register(
    role: 'coach' | 'utilisateur',
    coach?: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        prenom: 'Test',
        nom: 'Activite',
        email: `${randomUUID()}@example.test`,
        password: 'password123',
        role,
        ...(coach
          ? { coachId: coach, tailleCm: 170, age: 30, sexe: 'femme' }
          : {}),
      })
      .expect(201);
    return (response.body as { userId: string }).userId;
  }

  const token = (id: string, role: string) =>
    app.get(JwtService).sign({ sub: id, role });
  const sendSteps = (body: unknown, role = 'utilisateur') =>
    request(app.getHttpServer())
      .post('/api/activity/steps')
      .auth(token(role === 'coach' ? coachId : userId, role), {
        type: 'bearer',
      })
      .send(body as object);
  const plan = (niveauActivite?: string, path = '/api/plans/preview') =>
    request(app.getHttpServer())
      .post(path)
      .auth(token(coachId, 'coach'), { type: 'bearer' })
      .send({
        userId,
        poidsDepart: 82,
        poidsCible: 80,
        dateDebut: jourUtc(0),
        dateCible: jourUtc(-28),
        ...(niveauActivite ? { niveauActivite } : {}),
      });

  it('protège la réception : connexion requise et rôle utilisateur uniquement', async () => {
    await request(app.getHttpServer())
      .post('/api/activity/steps')
      .send({ nombrePas: 8000 })
      .expect(401);
    await sendSteps({ nombrePas: 8000 }, 'coach').expect(403);
    await request(app.getHttpServer()).get('/api/activity/me').expect(401);
  });

  it('enregistre les pas du jour sans plan actif, puis remplace le total du jour', async () => {
    const first = await sendSteps({ nombrePas: 8400 }).expect(201);
    expect(first.body).toMatchObject({ jourUtc: jourUtc(0), nombrePas: 8400 });

    await sendSteps({ nombrePas: 9100 }).expect(201);

    const row = await suivis.findOne({ _id: userId });
    expect(row?.planActif).toBeNull();
    expect(row?.pasQuotidiens).toHaveLength(1);
    expect(row?.pasQuotidiens?.[0]).toMatchObject({
      jourUtc: jourUtc(0),
      nombrePas: 9100,
    });
  });

  it('refuse un nombre de pas négatif, aberrant, décimal ou un champ en trop', async () => {
    for (const body of [
      { nombrePas: -1 },
      { nombrePas: 50001 },
      { nombrePas: 80000 },
      { nombrePas: 1200.5 },
      {},
      { nombrePas: 8000, jourUtc: '2026-01-01' },
    ]) {
      await sendSteps(body).expect(400);
    }
    const row = await suivis.findOne({ _id: userId });
    expect(row?.pasQuotidiens?.[0].nombrePas).toBe(9100);
  });

  it('expose l’historique sans déduire de niveau tant que 7 jours manquent', async () => {
    const { body } = (await request(app.getHttpServer())
      .get('/api/activity/me')
      .auth(token(userId, 'utilisateur'), { type: 'bearer' })
      .expect(200)) as { body: ActiviteBody };

    expect(body.historique).toEqual([
      expect.objectContaining({ jourUtc: jourUtc(0), nombrePas: 9100 }),
    ]);
    expect(body.moyenne7Jours).toMatchObject({
      joursRenseignes: 0,
      moyennePas: null,
      niveau: null,
    });
  });

  it('exige le niveau du coach quand l’historique de pas est incomplet', async () => {
    const response = await plan().expect(400);
    expect((response.body as { type: string }).type).toMatch(
      /activity-level-required$/,
    );
    await plan('actif').expect(200);
  });

  it('déduit Sportif de 7 jours à 8 200 pas de moyenne et laisse le coach décider', async () => {
    const repository = app.get(MongooseSuiviRepository);
    const suivi = await repository.charger(userId);
    if (!suivi) throw new Error('suivi attendu');
    const version = suivi.toProps().version;
    [8000, 8200, 8400, 8100, 8300, 7900, 8500].forEach((nombrePas, index) => {
      suivi.enregistrerPas(
        nombrePas,
        new Date(`${jourUtc(7 - index)}T20:00:00.000Z`),
      );
    });
    expect(await repository.sauvegarderSiVersion(suivi, version)).toBe(true);

    const deduit = await plan().expect(200);
    expect(deduit.body).toMatchObject({
      niveauActivite: 'sportif',
      niveauActiviteSource: 'pas',
      moyennePas7Jours: 8200,
    });

    const choisi = await plan('actif').expect(200);
    expect(choisi.body).toMatchObject({
      niveauActivite: 'actif',
      niveauActiviteSource: 'coach',
      moyennePas7Jours: null,
    });

    const progression = await request(app.getHttpServer())
      .get(`/api/coach/clients/${userId}`)
      .auth(token(coachId, 'coach'), { type: 'bearer' })
      .expect(200);
    expect((progression.body as { activite: unknown }).activite).toMatchObject({
      joursRenseignes: 7,
      moyennePas: 8200,
      niveau: 'sportif',
    });
  });

  it('fige le niveau déduit dans le plan créé', async () => {
    const created = await plan(undefined, '/api/plans').expect(201);
    expect((created.body as { niveauActivite: string }).niveauActivite).toBe(
      'sportif',
    );

    await sendSteps({ nombrePas: 20000 }).expect(201);

    const current = await request(app.getHttpServer())
      .get(`/api/plans/users/${userId}`)
      .auth(token(coachId, 'coach'), { type: 'bearer' })
      .expect(200);
    expect(current.body).toMatchObject({
      niveauActivite: 'sportif',
      budgetCalorique: (created.body as { budgetCalorique: number })
        .budgetCalorique,
    });
  });
});
