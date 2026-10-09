import { randomUUID } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Compte coach', () => {
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
      .send({
        prenom: 'Marie',
        nom: 'Dupont',
        email,
        password: 'password123',
        role,
        coachId,
      })
      .expect(HttpStatus.CREATED);
    return { id: (response.body as { userId: string }).userId, email };
  };

  it('protege les routes et les reserve au role coach', async () => {
    await request(app.getHttpServer()).get('/api/coach/me').expect(401);
    const coach = await register('coach');
    const user = await register('utilisateur', coach.id);
    await request(app.getHttpServer())
      .get('/api/coach/me')
      .auth(token(user.id, 'utilisateur'), { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/coach/me')
      .auth(token(user.id, 'utilisateur'), { type: 'bearer' })
      .send({ prenom: 'Paul' })
      .expect(403);
  });

  it("renvoie l'identite et le code du coach", async () => {
    const coach = await register('coach');
    const response = await request(app.getHttpServer())
      .get('/api/coach/me')
      .auth(token(coach.id, 'coach'), { type: 'bearer' })
      .expect(HttpStatus.OK);

    const body = response.body as Record<string, string>;
    expect(body).toEqual({
      id: coach.id,
      email: coach.email,
      prenom: 'Marie',
      nom: 'Dupont',
      coachCode: expect.stringMatching(/^EQ-[A-F0-9]{8}$/) as string,
    });
  });

  it("complete l'identite d'un ancien compte coach", async () => {
    const coach = await register('coach');
    const users = app
      .get<Connection>(getConnectionToken())
      .collection<{ _id: string }>('users');
    await users.updateOne(
      { _id: coach.id },
      { $unset: { prenom: '', nom: '' } },
    );
    const authorization = token(coach.id, 'coach');

    const before = await request(app.getHttpServer())
      .get('/api/coach/me')
      .auth(authorization, { type: 'bearer' })
      .expect(HttpStatus.OK);
    expect((before.body as { prenom?: string }).prenom).toBeUndefined();

    const updated = await request(app.getHttpServer())
      .patch('/api/coach/me')
      .auth(authorization, { type: 'bearer' })
      .send({ prenom: ' Lucie ', nom: 'Bernard' })
      .expect(HttpStatus.OK);
    const body = updated.body as { prenom: string; nom: string };
    expect(body.prenom).toBe('Lucie');
    expect(body.nom).toBe('Bernard');
  });

  it('refuse une modification vide ou trop longue', async () => {
    const coach = await register('coach');
    const authorization = token(coach.id, 'coach');
    await request(app.getHttpServer())
      .patch('/api/coach/me')
      .auth(authorization, { type: 'bearer' })
      .send({})
      .expect(HttpStatus.BAD_REQUEST);
    await request(app.getHttpServer())
      .patch('/api/coach/me')
      .auth(authorization, { type: 'bearer' })
      .send({ nom: 'x'.repeat(51) })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
