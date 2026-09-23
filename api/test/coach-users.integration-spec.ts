import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Utilisateurs rattaches au coach', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  const token = (id: string, role: string) =>
    app.get(JwtService).sign({ sub: id, role });
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
    return (response.body as { userId: string }).userId;
  };
  it('refuse les requetes anonymes et le role utilisateur', async () => {
    await request(app.getHttpServer()).get('/api/users/me/clients').expect(401);
    const coach = await register('coach');
    const user = await register('utilisateur', coach);
    await request(app.getHttpServer())
      .get('/api/users/me/clients')
      .auth(token(user, 'utilisateur'), { type: 'bearer' })
      .expect(403);
  });
  it('renvoie une liste vide puis uniquement ses utilisateurs sans donnees de connexion', async () => {
    const coach = await register('coach');
    const otherCoach = await register('coach');
    const get = () =>
      request(app.getHttpServer())
        .get('/api/users/me/clients')
        .auth(token(coach, 'coach'), { type: 'bearer' });
    expect((await get().expect(200)).body).toEqual([]);
    const ownUser = await register('utilisateur', coach);
    await register('utilisateur', otherCoach);
    const response = await get().expect(200);
    const rows = response.body as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(ownUser);
    expect(rows[0].tailleCm).toBe(170);
    expect(Object.keys(rows[0]).sort()).toEqual(['email', 'id', 'tailleCm']);
  });
});
