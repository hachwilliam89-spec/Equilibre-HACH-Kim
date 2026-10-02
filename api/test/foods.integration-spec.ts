import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { REFERENCE_FOODS } from '../src/foods/infrastructure/persistence/reference-foods';

interface FoodRow {
  _id: string;
  nom: string;
  nomNormalise: string;
  caloriesKcalPour100g: number;
  proteinesGPour100g: number;
  glucidesGPour100g: number;
  lipidesGPour100g: number;
}

describe("Bibliotheque d'aliments (integration)", () => {
  let app: INestApplication<App>;
  let collection: Collection<FoodRow>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    collection = app
      .get<Connection>(getConnectionToken())
      .collection<FoodRow>('aliments');
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('charge le referentiel avec des UUID applicatifs et des noms normalises', async () => {
    const rows = await collection
      .find({ _id: { $in: REFERENCE_FOODS.map((food) => food.id) } })
      .toArray();

    expect(rows).toHaveLength(REFERENCE_FOODS.length);
    expect(rows.every((row) => typeof row._id === 'string')).toBe(true);
    expect(rows).toContainEqual(
      expect.objectContaining({
        nom: 'Riz blanc cuit',
        nomNormalise: 'riz blanc cuit',
        caloriesKcalPour100g: 130,
        proteinesGPour100g: 2.7,
        glucidesGPour100g: 28,
        lipidesGPour100g: 0.3,
      }),
    );
  });

  it('possede un index unique sur le nom normalise', async () => {
    const indexes = await collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { nomNormalise: 1 }, unique: true }),
    );
  });

  it('reste idempotent lors du redemarrage de l’application', async () => {
    const before = await collection.countDocuments({
      _id: { $in: REFERENCE_FOODS.map((food) => food.id) },
    });

    const secondModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const secondApp = secondModule.createNestApplication();
    await secondApp.init();
    await secondApp.close();

    const after = await collection.countDocuments({
      _id: { $in: REFERENCE_FOODS.map((food) => food.id) },
    });
    expect(after).toBe(before);
  });
});
