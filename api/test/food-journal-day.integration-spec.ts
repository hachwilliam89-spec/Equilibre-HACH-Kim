import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { REFERENCE_FOODS } from '../src/foods/infrastructure/persistence/reference-foods';
import { DailyFoodJournal } from '../src/nutrition/domain/entities/daily-food-journal.entity';
import { FoodEntry } from '../src/nutrition/domain/entities/food-entry.entity';
import { Plan } from '../src/plans/domain/entities/plan.entity';
import { Suivi } from '../src/suivis/domain/entities/suivi.entity';
import { MongooseSuiviRepository } from '../src/suivis/infrastructure/persistence/mongoose-suivi.repository';

interface JournalResponse {
  jourUtc: string;
  entrees: { id: string; nom: string; quantiteGrammes: number }[];
  totalCaloriesKcal: number;
}

const jourUtc = (decalage: number) =>
  new Date(Date.now() - decalage * 86_400_000).toISOString().slice(0, 10);

describe("Journal alimentaire d'un jour passe (integration, FR403-754)", () => {
  let app: INestApplication<App>;
  let collection: Collection<{ _id: string }>;
  const userId = randomUUID();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    collection = app
      .get<Connection>(getConnectionToken())
      .collection<{ _id: string }>('suivis');

    const plan = Plan.restore({
      id: randomUUID(),
      userId,
      coachId: randomUUID(),
      poidsDepart: 80,
      poidsCible: 76,
      dateDebut: new Date('2026-01-01T00:00:00Z'),
      dateCible: new Date('2099-12-31T00:00:00Z'),
      imcCible: 24,
      niveauActivite: 'actif',
      budgetCalorique: 1800,
      budgetPlafonneAuBmr: false,
      statut: 'actif',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    // Journal d'il y a 4 jours, prepare directement en base (hors fenetre embarquee).
    const ilYaQuatreJours = new Date(`${jourUtc(4)}T12:00:00.000Z`);
    const journal = DailyFoodJournal.create(plan, ilYaQuatreJours);
    journal.ajouterEntree(
      FoodEntry.create({
        id: randomUUID(),
        aliment: REFERENCE_FOODS[0],
        quantiteGrammes: 200,
        receivedAt: ilYaQuatreJours,
      }),
    );
    const suivi = Suivi.create(userId);
    suivi.activerPlan(plan);
    suivi.ajouterJournalAlimentaire(journal, ilYaQuatreJours);
    expect(await app.get(MongooseSuiviRepository).creer(suivi)).toBe(true);
  });

  afterAll(async () => {
    if (collection) await collection.deleteMany({ _id: { $in: [userId] } });
    if (app) await app.close();
  });

  const token = (id: string, role = 'utilisateur') =>
    app.get(JwtService).sign({ sub: id, role });
  const day = (jour: string, role = 'utilisateur') =>
    request(app.getHttpServer())
      .get(`/api/food-journals/me/days/${jour}`)
      .auth(token(userId, role), { type: 'bearer' });

  it('protege la route : connexion requise et role utilisateur uniquement', async () => {
    await request(app.getHttpServer())
      .get(`/api/food-journals/me/days/${jourUtc(1)}`)
      .expect(401);
    await day(jourUtc(1), 'coach').expect(403);
  });

  it("renvoie les entrees et totaux d'un jour anterieur conserve", async () => {
    const { body } = (await day(jourUtc(4)).expect(200)) as {
      body: JournalResponse;
    };

    expect(body.jourUtc).toBe(jourUtc(4));
    expect(body.entrees).toHaveLength(1);
    expect(body.entrees[0].quantiteGrammes).toBe(200);
    expect(body.totalCaloriesKcal).toBeGreaterThan(0);
  });

  it('renvoie null pour un jour sans journal', async () => {
    const response = await day(jourUtc(2)).expect(200);
    expect(response.body).toBeNull();
  });

  it('refuse une date mal formee, inexistante ou future', async () => {
    await day('14-10-2026').expect(400);
    await day('2026-02-30').expect(400);
    await day(jourUtc(-1)).expect(400);
  });
});
