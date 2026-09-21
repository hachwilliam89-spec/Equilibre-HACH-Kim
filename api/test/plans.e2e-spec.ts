import { randomUUID } from 'crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Contrôles d'intégration complémentaires à Cucumber : profils incomplets,
 * droits de lecture/annulation, expiration à la lecture et cas calorique sédentaire.
 * Les scénarios métier communs sont dans test/cucumber/features/plans.feature.
 * Vraie
 * application Nest, vraie base MongoDB -- aucun mock, meme philosophie que
 * test/auth.e2e-spec.ts.
 *
 * Memes prerequis que auth.e2e-spec.ts : MONGO_URI, JWT_SECRET,
 * JWT_REFRESH_SECRET dans l'environnement (voir pnpm test:e2e:local).
 */
describe('Plans (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = () => `test-${randomUUID()}@equilibre.app`;

  interface RegisterProfile {
    tailleCm?: number;
    age?: number;
    sexe?: 'homme' | 'femme';
  }

  // Emet un access token valide directement via le JwtService de l'appli
  // (meme secret, meme forme de payload que LoginUseCase), sans passer par
  // POST /api/auth/login -- cette route est deliberement limitee a 5
  // tentatives/minute/IP (anti brute-force, voir auth.controller.ts) et la
  // plupart des tests de ce fichier n'ont besoin que d'un token valide, pas
  // de retester le login lui-meme (deja couvert par auth.e2e-spec.ts).
  const mintAccessToken = (
    testApp: INestApplication<App>,
    userId: string,
    role: 'coach' | 'utilisateur',
  ): string =>
    testApp.get(JwtService).sign({ sub: userId, role }, { expiresIn: '15m' });

  const registerAndLoginCoach = async (
    testApp: INestApplication<App>,
  ): Promise<{ coachId: string; accessToken: string }> => {
    const email = uniqueEmail();
    const password = 'password123';
    const registerResponse = await request(testApp.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, role: 'coach' })
      .expect(HttpStatus.CREATED);

    const coachId = (registerResponse.body as { userId: string }).userId;

    return {
      coachId,
      accessToken: mintAccessToken(testApp, coachId, 'coach'),
    };
  };

  // Profil complet par defaut (necessaire au calcul du BMR) ; les tests qui
  // verifient le cas "profil incomplet" ou "taille manquante" passent des
  // overrides explicites.
  const registerUtilisateur = async (
    testApp: INestApplication<App>,
    coachId: string,
    profile: RegisterProfile = { tailleCm: 170, age: 30, sexe: 'femme' },
  ): Promise<string> => {
    const response = await request(testApp.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: uniqueEmail(),
        password: 'password123',
        role: 'utilisateur',
        coachId,
        ...profile,
      })
      .expect(HttpStatus.CREATED);
    return (response.body as { userId: string }).userId;
  };

  // Utilisateur enregistre + son token, pour les tests de consultation
  // (GET /plans/me) qui ont besoin de leur propre token -- meme raisonnement
  // que mintAccessToken ci-dessus, pas de passage par POST /api/auth/login.
  const registerAndLoginUtilisateur = async (
    testApp: INestApplication<App>,
    coachId: string,
    profile: RegisterProfile = { tailleCm: 170, age: 30, sexe: 'femme' },
  ): Promise<{ userId: string; accessToken: string }> => {
    const registerResponse = await request(testApp.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: uniqueEmail(),
        password: 'password123',
        role: 'utilisateur',
        coachId,
        ...profile,
      })
      .expect(HttpStatus.CREATED);
    const userId = (registerResponse.body as { userId: string }).userId;
    return {
      userId,
      accessToken: mintAccessToken(testApp, userId, 'utilisateur'),
    };
  };

  // Dates calees sur "maintenant" (jamais figees dans le passe) : un plan
  // dont la dateCible est deja passee est auto-termine des la premiere
  // lecture (voir findActiveByUserId), ce qui casserait silencieusement
  // tout test qui recree/relit un plan cense rester actif.
  const daysFromNow = (days: number): string => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  // Plan de base valide : -4kg sur 4 semaines = -1kg/semaine (limite haute
  // acceptee), pour un utilisateur de 1.70m (IMC cible = 78/1.7^2 ~= 27).
  const validPlanBody = (userId: string) => ({
    userId,
    poidsDepart: 82,
    poidsCible: 78,
    dateDebut: daysFromNow(0),
    dateCible: daysFromNow(28),
    niveauActivite: 'sportif',
  });

  interface PlanRow {
    _id: string;
    userId: string;
    coachId: string;
    poidsDepart: number;
    poidsCible: number;
    dateDebut: string;
    dateCible: string;
    imcCible: number;
    niveauActivite: string;
    budgetCalorique: number;
    budgetPlafonneAuBmr: boolean;
    statut: 'actif' | 'termine' | 'annule';
  }

  // Forme du corps JSON renvoye par l'API (PlanProps serialise) : `id`, pas
  // `_id` -- distinct de PlanRow (document Mongo brut) utilise pour les
  // assertions directes en base.
  interface PlanResponseBody {
    id: string;
    userId: string;
    coachId: string;
    poidsDepart: number;
    poidsCible: number;
    dateDebut: string;
    dateCible: string;
    imcCible: number;
    niveauActivite: string;
    budgetCalorique: number;
    budgetPlafonneAuBmr: boolean;
    statut: 'actif' | 'termine' | 'annule';
  }

  const plansCollection = (
    testApp: INestApplication<App>,
  ): Collection<PlanRow> =>
    testApp.get<Connection>(getConnectionToken()).collection<PlanRow>('plans');

  describe('Authentification requise', () => {
    // Le garde JwtAuthGuard est applique au niveau du controleur (@UseGuards
    // au-dessus de la classe) : un seul jeu de cas suffit pour couvrir
    // chaque route de plans, pas la peine de dupliquer le meme test guard
    // par guard par endpoint.
    it.each<[string, string]>([
      ['post', '/api/plans'],
      ['post', '/api/plans/preview'],
      ['get', '/api/plans/me'],
      ['get', `/api/plans/users/${randomUUID()}`],
      ['post', `/api/plans/${randomUUID()}/cancel`],
    ])('refuse %s %s sans jeton', async (method, path) => {
      const req = request(app.getHttpServer()) as unknown as Record<
        'get' | 'post',
        (url: string) => request.Test
      >;
      await req[method as 'get' | 'post'](path).expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /api/plans', () => {
    it("refuse la creation si la taille du profil n'est pas renseignee", async () => {
      const { coachId, accessToken } = await registerAndLoginCoach(app);
      const userId = await registerUtilisateur(app, coachId, {
        age: 30,
        sexe: 'femme',
      });

      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPlanBody(userId))
        .expect(HttpStatus.BAD_REQUEST);

      expect(await plansCollection(app).countDocuments({ userId })).toBe(0);
    });

    it('refuse la suggestion automatique si le profil (age/sexe) est incomplet, sans budget fourni', async () => {
      const { coachId, accessToken } = await registerAndLoginCoach(app);
      const userId = await registerUtilisateur(app, coachId, {
        tailleCm: 170,
      });

      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPlanBody(userId))
        .expect(HttpStatus.BAD_REQUEST);

      expect(await plansCollection(app).countDocuments({ userId })).toBe(0);
    });

    it('accepte un profil incomplet si le coach fournit un budget calorique manuel', async () => {
      const { coachId, accessToken } = await registerAndLoginCoach(app);
      const userId = await registerUtilisateur(app, coachId, {
        tailleCm: 170,
      });

      const response = await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPlanBody(userId), budgetCalorique: 1600 })
        .expect(HttpStatus.CREATED);
      expect((response.body as PlanResponseBody).budgetCalorique).toBe(1600);
      expect((response.body as PlanResponseBody).budgetPlafonneAuBmr).toBe(
        false,
      );

      const doc = await plansCollection(app).findOne({ userId });
      expect(doc?.budgetCalorique).toBe(1600);
      expect(doc?.budgetPlafonneAuBmr).toBe(false);
    });

    it('plafonne le budget suggere au BMR quand le calcul brut tombe en dessous', async () => {
      const { coachId, accessToken } = await registerAndLoginCoach(app);
      // Petit gabarit + niveau Sedentaire : TDEE faible, deficit proche du
      // maximum autorise (1kg/semaine) -> budget suggere sous le BMR.
      const userId = await registerUtilisateur(app, coachId, {
        tailleCm: 155,
        age: 45,
        sexe: 'femme',
      });

      const response = await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...validPlanBody(userId),
          poidsDepart: 60,
          poidsCible: 56,
          niveauActivite: 'sedentaire',
        })
        .expect(HttpStatus.CREATED);
      const body = response.body as PlanResponseBody;
      expect(body.budgetPlafonneAuBmr).toBe(true);
    });

    it('refuse un plan si un plan actif existe deja pour cet utilisateur', async () => {
      const { coachId, accessToken } = await registerAndLoginCoach(app);
      const userId = await registerUtilisateur(app, coachId);

      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPlanBody(userId))
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPlanBody(userId))
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('POST /api/plans/:id/cancel', () => {
    it("refuse d'annuler un plan qui ne lui est pas rattache", async () => {
      const coachA = await registerAndLoginCoach(app);
      const userOfCoachA = await registerUtilisateur(app, coachA.coachId);
      const created = await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${coachA.accessToken}`)
        .send(validPlanBody(userOfCoachA))
        .expect(HttpStatus.CREATED);

      const coachB = await registerAndLoginCoach(app);

      await request(app.getHttpServer())
        .post(`/api/plans/${(created.body as PlanResponseBody).id}/cancel`)
        .set('Authorization', `Bearer ${coachB.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('GET /api/plans/me et /api/plans/users/:userId', () => {
    it('un utilisateur consulte son propre plan actif', async () => {
      const { coachId, accessToken: coachToken } =
        await registerAndLoginCoach(app);
      const { userId, accessToken: userToken } =
        await registerAndLoginUtilisateur(app, coachId);
      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${coachToken}`)
        .send(validPlanBody(userId))
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .get('/api/plans/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.OK);
      expect((response.body as PlanResponseBody).userId).toBe(userId);
    });

    it("un coach consulte le plan d'un utilisateur rattache", async () => {
      const { coachId, accessToken: coachToken } =
        await registerAndLoginCoach(app);
      const userId = await registerUtilisateur(app, coachId);
      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${coachToken}`)
        .send(validPlanBody(userId))
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .get(`/api/plans/users/${userId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(HttpStatus.OK);
      expect((response.body as PlanResponseBody).userId).toBe(userId);
    });

    it("refuse a un coach la consultation du plan d'un utilisateur non rattache", async () => {
      const coachA = await registerAndLoginCoach(app);
      const coachB = await registerAndLoginCoach(app);
      const userOfCoachB = await registerUtilisateur(app, coachB.coachId);

      await request(app.getHttpServer())
        .get(`/api/plans/users/${userOfCoachB}`)
        .set('Authorization', `Bearer ${coachA.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('passe automatiquement un plan expire en statut termine, verifie en base', async () => {
      const { coachId, accessToken } = await registerAndLoginCoach(app);
      const userId = await registerUtilisateur(app, coachId);

      // Insertion directe : plan actif dont la date cible est deja passee,
      // pour verifier le passage automatique en 'termine' sans dependre
      // d'une horloge systeme manipulee.
      const planId = randomUUID();
      await plansCollection(app).insertOne({
        _id: planId,
        userId,
        coachId,
        poidsDepart: 82,
        poidsCible: 78,
        dateDebut: new Date('2020-01-01') as unknown as string,
        dateCible: new Date('2020-01-29') as unknown as string,
        imcCible: 27,
        niveauActivite: 'sportif',
        budgetCalorique: 1800,
        budgetPlafonneAuBmr: false,
        statut: 'actif',
      });

      const docBefore = await plansCollection(app).findOne({ _id: planId });
      expect(docBefore?.statut).toBe('actif'); // pas encore lu, donc pas encore rafraichi

      // findActiveByUserId (invoque par le repository a chaque lecture) doit
      // maintenant le detecter expire, ne plus le renvoyer comme actif, et
      // persister le changement de statut.
      const response = await request(app.getHttpServer())
        .get(`/api/plans/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.text).toBe('null');
      expect(response.body).toBeNull();

      const docAfter = await plansCollection(app).findOne({ _id: planId });
      expect(docAfter?.statut).toBe('termine');
    });
  });
});
