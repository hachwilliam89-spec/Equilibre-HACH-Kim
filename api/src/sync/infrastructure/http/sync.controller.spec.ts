import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtStrategy } from '../../../auth/infrastructure/http/jwt.strategy';
import { ApplySyncOperationsUseCase } from '../../application/use-cases/apply-sync-operations.use-case';
import { GetSyncSnapshotUseCase } from '../../application/use-cases/get-sync-snapshot.use-case';
import type { OperationSynchro } from '../../domain/operation-synchro';
import { SyncController } from './sync.controller';

// Couche HTTP seule (use cases simulés) : codes de réponse, curseur, garde
// des rôles, conversion des horodatages et documentation Swagger. Le
// parcours complet avec MongoDB est couvert par test/sync.integration-spec.ts.
describe('SyncController (HTTP)', () => {
  let app: INestApplication<App>;
  let token: (role: string) => string;
  const snapshot = {
    execute: jest.fn().mockResolvedValue({
      suiviPoids: null,
      mesures: [],
      alimentation: null,
      favoris: [],
    }),
  };
  const apply = {
    execute: jest.fn((_userId: string, ops: OperationSynchro[]) =>
      Promise.resolve(ops.map((op) => ({ id: op.id, statut: 'appliquee' }))),
    ),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'secret-de-test-suffisamment-long-0123456789';
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: process.env.JWT_SECRET }),
      ],
      controllers: [SyncController],
      providers: [
        JwtStrategy,
        { provide: GetSyncSnapshotUseCase, useValue: snapshot },
        { provide: ApplySyncOperationsUseCase, useValue: apply },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    token = (role) => module.get(JwtService).sign({ sub: 'user-1', role });
  });

  afterAll(async () => {
    await app.close();
  });

  it('génère la documentation Swagger des deux routes', () => {
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(app, new DocumentBuilder().build()),
    );
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/api/sync/me', '/api/sync/me/operations']),
    );
    expect(document.components?.schemas).toHaveProperty('PushOperationsDto');
  });

  it('réserve la synchronisation au rôle utilisateur', async () => {
    await request(app.getHttpServer()).get('/api/sync/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/sync/me')
      .auth(token('coach'), { type: 'bearer' })
      .expect(403);
  });

  it('pull : 200 avec curseur, puis 204 sans corps avec ce même curseur', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/sync/me')
      .auth(token('utilisateur'), { type: 'bearer' })
      .expect(200);
    const { curseur } = first.body as { curseur: string };
    expect(first.headers['cache-control']).toBe('no-store');

    const second = await request(app.getHttpServer())
      .get('/api/sync/me')
      .query({ curseur })
      .auth(token('utilisateur'), { type: 'bearer' })
      .expect(204);
    expect(second.text).toBe('');
  });

  it('push : convertit les horodatages et renvoie résultats + instantané', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/sync/me/operations')
      .auth(token('utilisateur'), { type: 'bearer' })
      .send({
        operations: [
          {
            id: '6f1d2b5e-8c0e-4c55-9f43-2d8f0b6a7c11',
            type: 'saisie-poids',
            mesureId: '0b7e3c9a-1f2d-4e5b-8a6c-7d9e0f1a2b3c',
            poidsKg: 79,
            saisiLe: '2026-10-06T07:30:00.000+02:00',
          },
        ],
      })
      .expect(200);

    const [userId, operations] = apply.execute.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(operations[0]).toMatchObject({
      type: 'saisie-poids',
      saisiLe: new Date('2026-10-06T05:30:00.000Z'),
    });
    expect(response.body).toMatchObject({
      resultats: [{ statut: 'appliquee' }],
      instantane: { mesures: [], favoris: [] },
    });
  });

  it('push : refuse un lot invalide avant tout traitement', async () => {
    apply.execute.mockClear();
    await request(app.getHttpServer())
      .post('/api/sync/me/operations')
      .auth(token('utilisateur'), { type: 'bearer' })
      .send({ operations: [{ type: 'saisie-poids', poidsKg: 79 }] })
      .expect(400);
    expect(apply.execute).not.toHaveBeenCalled();
  });
});
