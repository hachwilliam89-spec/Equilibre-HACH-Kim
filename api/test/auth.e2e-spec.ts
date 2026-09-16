import { randomUUID } from 'crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { hashToken } from '../src/common/security/hash-token';

/**
 * Tests d'integration bout en bout du module auth : vraie application Nest,
 * vraie base MongoDB, vrai bcrypt, vrais tokens JWT signes -- aucun mock,
 * a la demande de l'encadrant.
 *
 * Prerequis pour lancer cette suite (`pnpm test:e2e`) :
 *  - un MongoDB reellement accessible via la variable MONGO_URI (par
 *    exemple `docker compose -f ../docker-compose.yml -f ../docker-compose.dev.yml up -d mongo`
 *    puis MONGO_URI=mongodb://<user>:<mdp>@localhost:<MONGO_PORT> dans
 *    l'environnement, ou directement le Mongo ephemere de docker-compose.test.yml) ;
 *  - JWT_SECRET et JWT_REFRESH_SECRET (32 caracteres minimum) dans
 *    l'environnement.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Reproduit exactement main.ts : sans ce prefixe, les routes testees ici
    // ne correspondraient pas a celles reellement exposees en dev/prod.
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Un email unique par appel : evite toute collision avec des donnees
  // laissees par une execution precedente, sans avoir besoin d'un acces
  // direct a la base pour la nettoyer entre les tests.
  const uniqueEmail = () => `test-${randomUUID()}@equilibre.app`;

  // Cree un compte coach et connecte-le, pour les tests qui ont besoin d'un
  // couple access/refresh token valide sans que ce ne soit l'objet du test.
  // Prend l'app en parametre (plutot que de fermer sur la variable `app`
  // du describe englobant) : POST /auth/login est limite a 5 tentatives
  // par minute et par IP, donc chaque bloc qui appelle cette fonction
  // plusieurs fois a besoin de sa propre instance Nest pour ne pas epuiser
  // le quota d'un autre bloc de tests.
  const registerAndLogin = async (
    testApp: INestApplication<App>,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> => {
    const email = uniqueEmail();
    const password = 'password123';
    await request(testApp.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, role: 'coach' })
      .expect(HttpStatus.CREATED);

    const response = await request(testApp.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);

    return response.body as { accessToken: string; refreshToken: string };
  };

  // Cree une instance Nest independante avec son propre etat de throttling
  // en memoire, pour les blocs de tests qui appellent login() plusieurs
  // fois et ne doivent pas partager leur quota avec le reste du fichier.
  const createIsolatedApp = async (): Promise<INestApplication<App>> => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const isolatedApp = moduleFixture.createNestApplication();
    isolatedApp.setGlobalPrefix('api');
    await isolatedApp.init();
    return isolatedApp;
  };

  // Acces direct aux collections Mongo, en contournant repository et
  // controller : les assertions sur les codes HTTP ne prouvent que le
  // comportement de l'API, pas ce qui a reellement ete persiste. Le driver
  // Mongo type _id en ObjectId par defaut ; nos schemas le stockent en
  // chaine opaque (voir user.schema.ts / refresh-token.schema.ts), d'ou ces
  // interfaces dediees plutot que le type Document generique.
  interface UserRow {
    _id: string;
    email: string;
    passwordHash: string;
    role: 'coach' | 'utilisateur';
  }

  interface RefreshTokenRow {
    _id: string;
    userId: string;
    tokenHash: string;
    revoked: boolean;
  }

  const usersCollection = (
    testApp: INestApplication<App>,
  ): Collection<UserRow> =>
    testApp.get<Connection>(getConnectionToken()).collection<UserRow>('users');

  const refreshTokensCollection = (
    testApp: INestApplication<App>,
  ): Collection<RefreshTokenRow> =>
    testApp
      .get<Connection>(getConnectionToken())
      .collection<RefreshTokenRow>('refresh_tokens');

  describe('POST /api/auth/register', () => {
    it('cree un compte coach et le persiste correctement en base', async () => {
      const email = uniqueEmail();
      const password = 'password123';
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password, role: 'coach' })
        .expect(HttpStatus.CREATED);

      const body = response.body as { userId: string };
      expect(typeof body.userId).toBe('string');
      expect(body.userId.length).toBeGreaterThan(0);

      // Assertion directe sur l'etat final de Mongo, pas seulement sur la
      // reponse HTTP : le document existe, avec un _id opaque (chaine, pas
      // un ObjectId Mongo -- voir user.schema.ts) et un hash bcrypt, jamais
      // le mot de passe en clair.
      const doc = await usersCollection(app).findOne({ _id: body.userId });
      expect(doc).not.toBeNull();
      expect(doc?._id).toBe(body.userId);
      expect(typeof doc?._id).toBe('string');
      expect(doc?.email).toBe(email);
      expect(doc?.role).toBe('coach');
      expect(doc?.passwordHash).not.toBe(password);
      expect(doc?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('refuse un utilisateur sans coachId (regle metier validee des le DTO)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'password123',
          role: 'utilisateur',
        })
        .expect(HttpStatus.BAD_REQUEST);

      const body = response.body as {
        errors: Array<{ field: string; message: string }>;
      };
      expect(body.errors.some((error) => error.field === 'coachId')).toBe(true);
    });

    it('refuse un email deja utilise', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'password123', role: 'coach' })
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'password123', role: 'coach' })
        .expect(HttpStatus.CONFLICT);

      const body = response.body as { type: string };
      expect(body.type).toContain('email-already-used');
    });
  });

  describe('POST /api/auth/login', () => {
    it('refuse un mot de passe incorrect', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'password123', role: 'coach' })
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'mauvais-mot-de-passe' })
        .expect(HttpStatus.UNAUTHORIZED);

      const body = response.body as { type: string };
      expect(body.type).toContain('invalid-credentials');
    });

    it('connecte un coach avec les bons identifiants et renvoie des tokens JWT', async () => {
      const email = uniqueEmail();
      const password = 'password123';
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password, role: 'coach' })
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(HttpStatus.OK);

      const body = response.body as {
        accessToken: string;
        refreshToken: string;
        role: string;
        userId: string;
      };
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
      expect(body.role).toBe('coach');
      expect(typeof body.userId).toBe('string');
      // Un vrai JWT signe a 3 segments (header.payload.signature) ; la
      // signature elle-meme n'a pas besoin d'etre revalidee ici.
      expect(body.accessToken.split('.')).toHaveLength(3);
    });
  });

  describe('POST /api/auth/refresh', () => {
    // Instance dediee : 3 des 4 tests ci-dessous se connectent, ce qui
    // resterait sous la limite de 5/min sur l'app partagee du describe
    // racine, mais la couplerait inutilement aux tests register/login
    // executes avant elle -- un test ajoute plus tard ailleurs dans le
    // fichier ne doit pas pouvoir faire echouer celui-ci.
    let refreshApp: INestApplication<App>;

    beforeAll(async () => {
      refreshApp = await createIsolatedApp();
    });

    afterAll(async () => {
      await refreshApp.close();
    });

    it('renouvelle access et refresh token (rotation), et persiste la revocation en base', async () => {
      const { refreshToken } = await registerAndLogin(refreshApp);

      const response = await request(refreshApp.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.OK);

      const body = response.body as {
        accessToken: string;
        refreshToken: string;
      };
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
      // La rotation doit emettre un nouveau refresh token, distinct de
      // l'ancien -- pas juste un nouvel access token.
      expect(body.refreshToken).not.toBe(refreshToken);

      // Assertion directe sur l'etat final de Mongo : l'ancien enregistrement
      // doit etre marque revoked, le nouveau doit exister et etre actif --
      // pas seulement "la reponse HTTP dit que ca a marche".
      const oldRecord = await refreshTokensCollection(refreshApp).findOne({
        tokenHash: hashToken(refreshToken),
      });
      expect(oldRecord?.revoked).toBe(true);

      const newRecord = await refreshTokensCollection(refreshApp).findOne({
        tokenHash: hashToken(body.refreshToken),
      });
      expect(newRecord).not.toBeNull();
      expect(newRecord?.revoked).toBe(false);
      expect(newRecord?._id).not.toBe(oldRecord?._id);
    });

    it("rejette la reutilisation d'un refresh token deja consomme (rejeu)", async () => {
      const { refreshToken } = await registerAndLogin(refreshApp);

      await request(refreshApp.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.OK);

      // Le meme refresh token, deja tourne une premiere fois, doit
      // maintenant etre refuse -- la rotation ne sert a rien si un jeton
      // vole reste utilisable apres avoir ete legitimement renouvele.
      const response = await request(refreshApp.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.UNAUTHORIZED);

      const body = response.body as { type: string };
      expect(body.type).toContain('invalid-refresh-token');

      // Le rejeu refuse ne doit avoir cree aucun nouvel enregistrement en
      // base : un seul refresh token actif doit exister pour cet ancien
      // enregistrement, celui issu de la premiere rotation legitime.
      const oldRecord = await refreshTokensCollection(refreshApp).findOne({
        tokenHash: hashToken(refreshToken),
      });
      const activeRecords = await refreshTokensCollection(refreshApp)
        .find({ userId: oldRecord?.userId, revoked: false })
        .toArray();
      expect(activeRecords).toHaveLength(1);
    });

    it('un seul de deux renouvellements simultanes avec le meme refresh token reussit (concurrence)', async () => {
      const { refreshToken } = await registerAndLogin(refreshApp);
      const oldRecordBefore = await refreshTokensCollection(refreshApp).findOne(
        { tokenHash: hashToken(refreshToken) },
      );

      // Deux requetes concurrentes avec le meme refresh token (ex: deux
      // onglets, un retry reseau) : la revocation doit etre atomique, donc
      // une seule doit reussir, l'autre doit echouer -- jamais les deux.
      const [first, second] = await Promise.all([
        request(refreshApp.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken }),
        request(refreshApp.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken }),
      ]);

      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([HttpStatus.OK, HttpStatus.UNAUTHORIZED]);

      // La preuve n'est pas dans les codes HTTP mais en base : peu importe
      // combien de requetes concurrentes ont ete envoyees, un seul nouveau
      // refresh token actif doit exister pour cet utilisateur -- jamais
      // deux, ce qui signalerait que la revocation atomique n'a pas
      // empeche une double emission.
      const activeRecords = await refreshTokensCollection(refreshApp)
        .find({ userId: oldRecordBefore?.userId, revoked: false })
        .toArray();
      expect(activeRecords).toHaveLength(1);
    });

    it('rejette un refresh token invalide', async () => {
      const response = await request(refreshApp.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'ceci-nest-pas-un-jwt' })
        .expect(HttpStatus.UNAUTHORIZED);

      const body = response.body as { type: string };
      expect(body.type).toContain('invalid-refresh-token');
    });
  });

  describe('POST /api/auth/logout', () => {
    // Instance dediee, meme raison que POST /api/auth/refresh ci-dessus.
    let logoutApp: INestApplication<App>;

    beforeAll(async () => {
      logoutApp = await createIsolatedApp();
    });

    afterAll(async () => {
      await logoutApp.close();
    });

    it('revoque le refresh token en base : un renouvellement ulterieur echoue', async () => {
      const { refreshToken } = await registerAndLogin(logoutApp);

      await request(logoutApp.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(HttpStatus.NO_CONTENT);

      // Assertion directe sur l'etat final de Mongo : le document existe
      // toujours (logout ne supprime pas, il revoque), avec revoked: true.
      const record = await refreshTokensCollection(logoutApp).findOne({
        tokenHash: hashToken(refreshToken),
      });
      expect(record).not.toBeNull();
      expect(record?.revoked).toBe(true);

      await request(logoutApp.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it("est idempotent : deconnecter deux fois ne renvoie pas d'erreur", async () => {
      const { refreshToken } = await registerAndLogin(logoutApp);

      await request(logoutApp.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(HttpStatus.NO_CONTENT);

      await request(logoutApp.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(HttpStatus.NO_CONTENT);
    });
  });

  describe('Limitation des requetes sur /api/auth/login', () => {
    // Instance Nest dediee : le throttler garde ses compteurs en memoire
    // par instance d'application, donc partager l'app des describe
    // precedents ferait dependre ce test du nombre de connexions deja
    // tentees ailleurs dans le fichier.
    let throttleApp: INestApplication<App>;

    beforeAll(async () => {
      throttleApp = await createIsolatedApp();
    });

    afterAll(async () => {
      await throttleApp.close();
    });

    it('bloque au-dela de 5 tentatives de connexion par minute et par IP', async () => {
      const email = uniqueEmail();
      const attempt = () =>
        request(throttleApp.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'peu-importe-le-mot-de-passe' });

      const responses = [];
      for (let i = 0; i < 6; i += 1) {
        // Sequentiel et non Promise.all : le but est de depasser la limite
        // de 5/min, pas de tester une race condition ici.
        responses.push(await attempt());
      }

      const statuses = responses.map((response) => response.status);
      expect(statuses.slice(0, 5)).not.toContain(HttpStatus.TOO_MANY_REQUESTS);
      expect(statuses[5]).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });
});
