import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { REFERENCE_FOODS } from '../src/foods/infrastructure/persistence/reference-foods';

interface FoodResponse {
  id: string;
  nom: string;
  caloriesKcalPour100g: number;
  proteinesGPour100g: number;
  glucidesGPour100g: number;
  lipidesGPour100g: number;
}

describe('Recherche des aliments de référence (intégration)', () => {
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

  const token = (role: string) =>
    app.get(JwtService).sign({ sub: randomUUID(), role });

  const search = (role: string, query?: Record<string, string>) => {
    const call = request(app.getHttpServer())
      .get('/api/foods')
      .auth(token(role), { type: 'bearer' });
    return query ? call.query(query) : call;
  };

  it('réserve la recherche aux coachs et utilisateurs connectés', async () => {
    await request(app.getHttpServer()).get('/api/foods').expect(401);
    await search('autre').expect(403);
    await search('coach').expect(200);
    await search('utilisateur').expect(200);
  });

  it('recherche sans casse ni accents et retourne uniquement les données publiques pour 100 g', async () => {
    const result = await search('utilisateur', { q: 'PÂTES' }).expect(200);
    expect(result.body).toEqual([
      {
        id: REFERENCE_FOODS.find((food) => food.nom === 'Pâtes cuites')?.id,
        nom: 'Pâtes cuites',
        caloriesKcalPour100g: 167,
        proteinesGPour100g: 6.1,
        glucidesGPour100g: 31.4,
        lipidesGPour100g: 1.1,
      },
    ] satisfies FoodResponse[]);
    expect((await search('coach', { q: 'oeuf' }).expect(200)).body).toEqual([
      expect.objectContaining({ nom: 'Œuf dur' }),
    ]);
  });

  it('retourne une liste vide pour une recherche absente et interprète les caractères spéciaux littéralement', async () => {
    expect(
      (await search('coach', { q: 'introuvable' }).expect(200)).body,
    ).toEqual([]);
    expect((await search('coach', { q: '.*' }).expect(200)).body).toEqual([]);
  });

  it('pagine dans un ordre stable et retourne une liste vide au-delà de la fin', async () => {
    const all = (await search('coach', { size: '50' }).expect(200))
      .body as FoodResponse[];
    const first = (await search('coach', { page: '1', size: '3' }).expect(200))
      .body as FoodResponse[];
    const second = (await search('coach', { page: '2', size: '3' }).expect(200))
      .body as FoodResponse[];
    expect(all).toHaveLength(REFERENCE_FOODS.length);
    expect(first).toEqual(all.slice(0, 3));
    expect(second).toEqual(all.slice(3, 6));
    expect(
      (await search('coach', { page: '10', size: '3' }).expect(200)).body,
    ).toEqual([]);
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { size: '0' },
    { size: '51' },
    { size: 'abc' },
    { q: 'a'.repeat(101) },
    { unexpected: 'value' },
  ])('refuse les paramètres invalides : %j', async (query) => {
    await search('coach', query).expect(400);
  });

  it('ne propose aucune écriture sur la bibliothèque', async () => {
    await request(app.getHttpServer())
      .post('/api/foods')
      .auth(token('utilisateur'), { type: 'bearer' })
      .send({ nom: 'Test' })
      .expect(404);
  });
});
