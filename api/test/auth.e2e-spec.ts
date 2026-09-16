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
});
