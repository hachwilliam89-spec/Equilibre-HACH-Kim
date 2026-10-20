import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureTrustedProxy } from '../src/config/http-proxy';

describe('limitation login derrière un reverse proxy', () => {
  let app: NestExpressApplication;

  async function open(ips: string[]) {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    configureTrustedProxy(app, ips);
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  function attempt(forwarded: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', forwarded)
      .send({
        email: 'absent-proxy-test@equilibre.example',
        password: 'mot-de-passe-test',
      });
  }

  it('sépare les quotas de deux clients derrière un proxy de confiance', async () => {
    await open(['127.0.0.1', '::1']);
    for (let i = 0; i < 5; i++) await attempt('198.51.100.1').expect(401);
    await attempt('198.51.100.1').expect(429);
    await attempt('198.51.100.2').expect(401);
  });

  it('ignore les adresses forgées placées avant le vrai client', async () => {
    await open(['127.0.0.1', '::1']);
    for (let i = 0; i < 5; i++)
      await attempt(`203.0.113.${i + 1}, 198.51.100.3`).expect(401);
    await attempt('203.0.113.99, 198.51.100.3').expect(429);
  });

  it.each([{ ips: [] }, { ips: ['192.0.2.10'] }])(
    'ignore X-Forwarded-For en accès direct ou depuis un proxy non fiable : $ips',
    async ({ ips }) => {
      await open(ips);
      for (let i = 0; i < 5; i++)
        await attempt(`198.51.100.${i + 1}`).expect(401);
      await attempt('198.51.100.99').expect(429);
    },
  );
});
