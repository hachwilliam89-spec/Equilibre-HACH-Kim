import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { REFERENCE_FOODS } from '../src/foods/infrastructure/persistence/reference-foods';

interface FoodResponse {
  id: string;
  nom: string;
  categorie: string;
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
    const pates = REFERENCE_FOODS.find((food) => food.nom === 'Pâtes cuites');
    if (!pates) throw new Error('Aliment de référence manquant : Pâtes cuites');
    expect(result.body).toEqual([
      {
        id: pates.id,
        nom: 'Pâtes cuites',
        categorie: 'feculents',
        caloriesKcalPour100g: 167,
        proteinesGPour100g: 6.1,
        glucidesGPour100g: 31.4,
        lipidesGPour100g: 1.1,
      },
    ] satisfies FoodResponse[]);
    expect((await search('coach', { q: 'oeuf' }).expect(200)).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ nom: 'Œuf dur' })]),
    );
  });

  it('retourne une liste vide pour une recherche absente et interprète les caractères spéciaux littéralement', async () => {
    expect(
      (await search('coach', { q: 'introuvable' }).expect(200)).body,
    ).toEqual([]);
    expect((await search('coach', { q: '.*' }).expect(200)).body).toEqual([]);
  });

  it('parcourt une famille et trouve les produits laitiers courants', async () => {
    const dairy = (
      await search('utilisateur', {
        categorie: 'produits-laitiers',
        size: '50',
      }).expect(200)
    ).body as FoodResponse[];
    expect(dairy.map((food) => food.nom)).toEqual(
      expect.arrayContaining([
        'Fromage blanc nature (2-3 % MG)',
        'Yaourt nature',
        'Yaourt grec nature',
      ]),
    );
    expect(dairy.every((food) => food.categorie === 'produits-laitiers')).toBe(
      true,
    );
    expect(
      (await search('utilisateur', { q: 'yaourt' }).expect(200)).body,
    ).toHaveLength(2);
    await search('coach', { categorie: 'inconnue' }).expect(400);
  });

  it('conserve des favoris propres au compte, sans doublon et sans nouvelle collection', async () => {
    const userId = randomUUID();
    const anotherUserId = randomUUID();
    const users = app.get<Connection>(getConnectionToken()).collection('users');
    await users.insertMany(
      [userId, anotherUserId].map((id) => ({
        _id: id,
        email: `${id}@example.test`,
        passwordHash: 'test',
        role: 'utilisateur',
      })),
    );
    const foodId = REFERENCE_FOODS[0].id;
    const favoriteUrl = `/api/foods/me/favorites/${foodId}`;
    const asUser = (id: string) =>
      app.get(JwtService).sign({ sub: id, role: 'utilisateur' });
    try {
      await request(app.getHttpServer())
        .put(favoriteUrl)
        .auth(asUser(userId), { type: 'bearer' })
        .expect(204);
      await request(app.getHttpServer())
        .put(favoriteUrl)
        .auth(asUser(userId), { type: 'bearer' })
        .expect(204);
      const own = await request(app.getHttpServer())
        .get('/api/foods/me/favorites')
        .auth(asUser(userId), { type: 'bearer' })
        .expect(200);
      expect(own.body).toEqual([expect.objectContaining({ id: foodId })]);
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/foods/me/favorites')
            .auth(asUser(anotherUserId), { type: 'bearer' })
            .expect(200)
        ).body,
      ).toEqual([]);
      expect((await users.findOne({ _id: userId }))?.favoriteFoodIds).toEqual([
        foodId,
      ]);
      await request(app.getHttpServer())
        .put(`/api/foods/me/favorites/${randomUUID()}`)
        .auth(asUser(userId), { type: 'bearer' })
        .expect(404);
      await request(app.getHttpServer())
        .delete(favoriteUrl)
        .auth(asUser(userId), { type: 'bearer' })
        .expect(204);
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/foods/me/favorites')
            .auth(asUser(userId), { type: 'bearer' })
            .expect(200)
        ).body,
      ).toEqual([]);
      await request(app.getHttpServer())
        .put(favoriteUrl)
        .auth(token('coach'), { type: 'bearer' })
        .expect(403);
    } finally {
      await users.deleteMany({ _id: { $in: [userId, anotherUserId] } });
    }
  });

  it('pagine dans un ordre stable et retourne une liste vide au-delà de la fin', async () => {
    const all = [
      ...((await search('coach', { page: '1', size: '50' }).expect(200))
        .body as FoodResponse[]),
      ...((await search('coach', { page: '2', size: '50' }).expect(200))
        .body as FoodResponse[]),
    ];
    const first = (await search('coach', { page: '1', size: '3' }).expect(200))
      .body as FoodResponse[];
    const second = (await search('coach', { page: '2', size: '3' }).expect(200))
      .body as FoodResponse[];
    expect(all).toHaveLength(REFERENCE_FOODS.length);
    expect(first).toEqual(all.slice(0, 3));
    expect(second).toEqual(all.slice(3, 6));
    expect(
      (await search('coach', { page: '100', size: '3' }).expect(200)).body,
    ).toEqual([]);
  });

  const invalidQueries: Record<string, string>[] = [
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { size: '0' },
    { size: '51' },
    { size: 'abc' },
    { q: 'a'.repeat(101) },
    { unexpected: 'value' },
  ];
  it.each(invalidQueries)(
    'refuse les paramètres invalides : %j',
    async (query) => {
      await search('coach', query).expect(400);
    },
  );

  it('ne propose aucune écriture sur la bibliothèque', async () => {
    await request(app.getHttpServer())
      .post('/api/foods')
      .auth(token('utilisateur'), { type: 'bearer' })
      .send({ nom: 'Test' })
      .expect(404);
  });
});
