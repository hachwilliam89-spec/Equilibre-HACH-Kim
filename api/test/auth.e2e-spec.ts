import { randomUUID } from 'crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

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
  const registerAndLogin = async (): Promise<{
    accessToken: string;
    refreshToken: string;
  }> => {
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

    return response.body as { accessToken: string; refreshToken: string };
  };

  describe('POST /api/auth/register', () => {
    it('cree un compte coach et renvoie son id', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'password123',
          role: 'coach',
        })
        .expect(HttpStatus.CREATED);

      const body = response.body as { userId: string };
      expect(typeof body.userId).toBe('string');
      expect(body.userId.length).toBeGreaterThan(0);
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
    it('renouvelle access et refresh token (rotation)', async () => {
      const { refreshToken } = await registerAndLogin();

      const response = await request(app.getHttpServer())
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
    });

    it("rejette la reutilisation d'un refresh token deja consomme (rejeu)", async () => {
      const { refreshToken } = await registerAndLogin();

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.OK);

      // Le meme refresh token, deja tourne une premiere fois, doit
      // maintenant etre refuse -- la rotation ne sert a rien si un jeton
      // vole reste utilisable apres avoir ete legitimement renouvele.
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.UNAUTHORIZED);

      const body = response.body as { type: string };
      expect(body.type).toContain('invalid-refresh-token');
    });

    it('un seul de deux renouvellements simultanes avec le meme refresh token reussit (concurrence)', async () => {
      const { refreshToken } = await registerAndLogin();

      // Deux requetes concurrentes avec le meme refresh token (ex: deux
      // onglets, un retry reseau) : la revocation doit etre atomique, donc
      // une seule doit reussir, l'autre doit echouer -- jamais les deux.
      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken }),
        request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken }),
      ]);

      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([HttpStatus.OK, HttpStatus.UNAUTHORIZED]);
    });

    it('rejette un refresh token invalide', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'ceci-nest-pas-un-jwt' })
        .expect(HttpStatus.UNAUTHORIZED);

      const body = response.body as { type: string };
      expect(body.type).toContain('invalid-refresh-token');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revoque le refresh token : un renouvellement ulterieur echoue', async () => {
      const { refreshToken } = await registerAndLogin();

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it("est idempotent : deconnecter deux fois ne renvoie pas d'erreur", async () => {
      const { refreshToken } = await registerAndLogin();

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
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
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      throttleApp = moduleFixture.createNestApplication();
      throttleApp.setGlobalPrefix('api');
      await throttleApp.init();
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
