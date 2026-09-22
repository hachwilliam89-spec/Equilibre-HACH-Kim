import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserDocumentClass } from '../src/auth/infrastructure/persistence/user.schema';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../src/auth/domain/ports/user-repository.port';

describe('Code coach (integration Mongo)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app
      .get<Model<UserDocumentClass>>(getModelToken(UserDocumentClass.name))
      .init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('attribue un code stable au coach existant et rattache uniquement les inscriptions valides', async () => {
    const email = `code-${randomUUID()}@example.test`;
    const password = 'password123';
    const coach = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, role: 'coach' })
      .expect(201);
    const users = app
      .get<Connection>(getConnectionToken())
      .collection<{ _id: string; coachCode?: string; coachId?: string }>(
        'users',
      );
    expect(
      (await users.findOne({ _id: (coach.body as { userId: string }).userId }))
        ?.coachCode,
    ).toBeUndefined();
    const repository = app.get<UserRepositoryPort>(USER_REPOSITORY);
    const codes = await Promise.all([
      repository.ensureCoachCode((coach.body as { userId: string }).userId),
      repository.ensureCoachCode((coach.body as { userId: string }).userId),
    ]);
    expect(codes[0]).toMatch(/^EQ-[A-F0-9]{8}$/);
    expect(codes[1]).toBe(codes[0]);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect((login.body as { coachCode: string }).coachCode).toBe(codes[0]);
    const repeat = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect((repeat.body as { coachCode: string }).coachCode).toBe(codes[0]);
    const user = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `user-${randomUUID()}@example.test`,
        password,
        role: 'utilisateur',
        coachCode: ` ${codes[0].toLowerCase()} `,
      })
      .expect(201);
    expect(
      (await users.findOne({ _id: (user.body as { userId: string }).userId }))
        ?.coachId,
    ).toBe((coach.body as { userId: string }).userId);
    const invalidEmail = `invalid-${randomUUID()}@example.test`;
    let unknownCode = 'EQ-00000000';
    while (await users.findOne({ coachCode: unknownCode }))
      unknownCode = `EQ-${randomUUID().slice(0, 8).toUpperCase()}`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: invalidEmail,
        password,
        role: 'utilisateur',
        coachCode: unknownCode,
      })
      .expect(400);
    expect(await users.findOne({ email: invalidEmail })).toBeNull();
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: invalidEmail,
        password,
        role: 'utilisateur',
        coachCode: codes[0],
        coachId: (coach.body as { userId: string }).userId,
      })
      .expect(400);
    const indexes = await users.indexes();
    expect(
      indexes.some((index) => index.key.coachCode === 1 && index.unique),
    ).toBe(true);
  });
});
