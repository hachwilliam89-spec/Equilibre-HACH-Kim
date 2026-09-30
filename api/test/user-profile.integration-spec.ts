import { randomUUID } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Profil utilisateur', () => {
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

  const token = (id: string, role: 'coach' | 'utilisateur') =>
    app.get(JwtService).sign({ sub: id, role });

  const register = async (role: 'coach' | 'utilisateur', coachId?: string) => {
    const email = `${randomUUID()}@example.test`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'password123', role, coachId })
      .expect(HttpStatus.CREATED);
    return { id: (response.body as { userId: string }).userId, email };
  };

  it('protege explicitement les deux routes et les reserve aux utilisateurs', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
    await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .send({ tailleCm: 170 })
      .expect(401);

    const coach = await register('coach');
    const authorization = token(coach.id, 'coach');
    await request(app.getHttpServer())
      .get('/api/users/me')
      .auth(authorization, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .auth(authorization, { type: 'bearer' })
      .send({ tailleCm: 170 })
      .expect(403);
  });

  it("complete le profil d'un ancien compte sans modifier son rattachement", async () => {
    const coach = await register('coach');
    const user = await register('utilisateur', coach.id);
    const authorization = token(user.id, 'utilisateur');

    const initial = await request(app.getHttpServer())
      .get('/api/users/me')
      .auth(authorization, { type: 'bearer' })
      .expect(HttpStatus.OK);
    expect(initial.body).toEqual({
      id: user.id,
      email: user.email,
      coach: { id: coach.id, email: coach.email },
    });

    const updated = await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .auth(authorization, { type: 'bearer' })
      .send({ tailleCm: 171, age: 34, sexe: 'homme' })
      .expect(HttpStatus.OK);
    expect(updated.body).toEqual({
      id: user.id,
      email: user.email,
      coach: { id: coach.id, email: coach.email },
      tailleCm: 171,
      age: 34,
      sexe: 'homme',
    });

    interface UserRow {
      _id: string;
      coachId?: string;
      profil?: { tailleCm?: number; age?: number; sexe?: string };
    }
    const users = app
      .get<Connection>(getConnectionToken())
      .collection<UserRow>('users');
    const stored = await users.findOne({ _id: user.id });
    expect(stored?.coachId).toBe(coach.id);
    expect(stored?.profil).toEqual({ tailleCm: 171, age: 34, sexe: 'homme' });
  });

  it('refuse les valeurs invalides sans modifier le profil', async () => {
    const coach = await register('coach');
    const user = await register('utilisateur', coach.id);
    const authorization = token(user.id, 'utilisateur');

    await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .auth(authorization, { type: 'bearer' })
      .send({ tailleCm: 0 })
      .expect(HttpStatus.BAD_REQUEST);

    const profile = await request(app.getHttpServer())
      .get('/api/users/me')
      .auth(authorization, { type: 'bearer' })
      .expect(HttpStatus.OK);
    const body = profile.body as { tailleCm?: number };
    expect(body.tailleCm).toBeUndefined();
  });
});
