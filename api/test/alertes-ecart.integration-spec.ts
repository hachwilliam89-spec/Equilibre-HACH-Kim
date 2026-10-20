import { randomUUID } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Collection, Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Measurement } from '../src/measurements/domain/entities/measurement.entity';
import { DailyFoodJournal } from '../src/nutrition/domain/entities/daily-food-journal.entity';
import { FoodEntry } from '../src/nutrition/domain/entities/food-entry.entity';
import { Plan } from '../src/plans/domain/entities/plan.entity';
import { Suivi } from '../src/suivis/domain/entities/suivi.entity';
import { MongooseSuiviRepository } from '../src/suivis/infrastructure/persistence/mongoose-suivi.repository';

interface AlerteBody {
  metrique: 'poids' | 'calories';
  serie: number;
  depuis: string;
  derniere: { jourUtc: string; ecart: number; horsTolerance: boolean };
}

interface PlanBody {
  id: string;
  poidsCible: number;
  dateCible: string;
  budgetCalorique: number;
  budgetPlafonneAuBmr: boolean;
  poidsAjusteLe?: string;
  budgetAjusteLe?: string;
}

const JOUR_MS = 86_400_000;
const jourUtc = (decalage: number) =>
  new Date(Date.now() + decalage * JOUR_MS).toISOString().slice(0, 10);

describe('Alertes d’écart persistant et ajustement du plan — US5 (intégration)', () => {
  let app: INestApplication<App>;
  let suivis: MongooseSuiviRepository;
  let collection: Collection<{ _id: string }>;
  const userIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    suivis = app.get(MongooseSuiviRepository);
    collection = app
      .get<Connection>(getConnectionToken())
      .collection<{ _id: string }>('suivis');
  });

  afterAll(async () => {
    if (collection && userIds.length) {
      await collection.deleteMany({ _id: { $in: userIds } });
    }
    if (app) await app.close();
  });

  const token = (id: string, role: string) =>
    app.get(JwtService).sign({ sub: id, role });

  const register = async (role: 'coach' | 'utilisateur', coachId?: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        prenom: 'Test',
        nom: 'Equilibre',
        email: `${randomUUID()}@example.test`,
        password: 'password123',
        role,
        coachId,
        tailleCm: 175,
        age: 30,
        sexe: 'femme',
      })
      .expect(HttpStatus.CREATED);
    const userId = (response.body as { userId: string }).userId;
    if (role === 'utilisateur') userIds.push(userId);
    return userId;
  };

  function journal(planId: string, jour: string, caloriesKcal: number) {
    const journee = DailyFoodJournal.restore({
      planId,
      jourUtc: jour,
      budgetCalorique: 1800,
      entrees: [],
      totalCaloriesKcal: 0,
      totalProteinesG: 0,
      totalGlucidesG: 0,
      totalLipidesG: 0,
    });
    journee.ajouterEntree(
      FoodEntry.restore({
        id: randomUUID(),
        aliment: {
          id: 'riz',
          nom: 'Riz blanc cuit',
          caloriesKcalPour100g: 130,
          proteinesGPour100g: 2.7,
          glucidesGPour100g: 28,
          lipidesGPour100g: 0.3,
        },
        quantiteGrammes: caloriesKcal / 1.3,
        caloriesKcal,
        proteinesG: 0,
        glucidesG: 0,
        lipidesG: 0,
        categorieRepas: 'dejeuner',
        receivedAt: new Date(`${jour}T12:00:00Z`),
      }),
    );
    return journee;
  }

  /**
   * Plan actif démarré il y a 10 jours (80 → 75 kg, budget 1800 kcal) avec
   * 3 pesées valides à environ +2,5 kg de la trajectoire (J-3 à J-1) et
   * 3 journées clôturées à 2100 kcal (J-4 à J-2) : les deux alertes.
   */
  async function seedEnEcart(userId: string, coachId: string) {
    const debut = new Date(`${jourUtc(-10)}T00:00:00Z`);
    const plan = Plan.restore({
      id: randomUUID(),
      userId,
      coachId,
      poidsDepart: 80,
      poidsCible: 75,
      dateDebut: debut,
      dateCible: new Date(`${jourUtc(120)}T00:00:00Z`),
      imcCible: 24.5,
      niveauActivite: 'actif',
      budgetCalorique: 1800,
      budgetPlafonneAuBmr: false,
      statut: 'actif',
      createdAt: debut,
    });
    const mesures = [-3, -2, -1].map((decalage) =>
      Measurement.restore({
        id: randomUUID(),
        userId,
        planId: plan.id,
        poidsKg: 82.5,
        receivedAt: new Date(`${jourUtc(decalage)}T07:00:00Z`),
        jourUtc: jourUtc(decalage),
        source: 'automatique',
        statut: 'valide',
      }),
    );
    const suivi = Suivi.restore({
      userId,
      version: 0,
      planActif: plan,
      plans: [],
      mesures,
      derniereMesureValide: mesures[2],
      blocageJournalier: null,
      journauxAlimentaires: [-4, -3, -2].map((decalage) =>
        journal(plan.id, jourUtc(decalage), 2100),
      ),
      entreesRetirees: [],
    });
    expect(await suivis.creer(suivi)).toBe(true);
    return plan;
  }

  const alerts = (coachId: string, role = 'coach') =>
    request(app.getHttpServer())
      .get('/api/coach/alerts')
      .auth(token(coachId, role), { type: 'bearer' });

  const patch = (
    coachId: string,
    planId: string,
    body: object,
    role = 'coach',
  ) =>
    request(app.getHttpServer())
      .patch(`/api/plans/${planId}`)
      .auth(token(coachId, role), { type: 'bearer' })
      .send(body);

  const slug = (body: unknown) => (body as { type: string }).type;

  it('réserve les alertes au coach authentifié', async () => {
    await request(app.getHttpServer())
      .get('/api/coach/alerts')
      .expect(HttpStatus.UNAUTHORIZED);
    await alerts(randomUUID(), 'utilisateur').expect(HttpStatus.FORBIDDEN);
  });

  it('signale poids et calories au seul coach de rattachement', async () => {
    const coach = await register('coach');
    const autreCoach = await register('coach');
    const enEcart = await register('utilisateur', coach);
    const sansPlan = await register('utilisateur', coach);
    await seedEnEcart(enEcart, coach);

    const response = await alerts(coach).expect(HttpStatus.OK);
    const rows = response.body as { id: string; alertes: AlerteBody[] }[];
    expect(rows.map((row) => row.id)).toEqual([enEcart]);
    expect(rows.map((row) => row.id)).not.toContain(sansPlan);
    expect(rows[0].alertes).toEqual([
      expect.objectContaining({
        metrique: 'poids',
        serie: 3,
        depuis: jourUtc(-3),
      }),
      expect.objectContaining({
        metrique: 'calories',
        serie: 3,
        depuis: jourUtc(-4),
        derniere: { jourUtc: jourUtc(-2), ecart: 300, horsTolerance: true },
      }),
    ]);

    // Isolation : un autre coach ne voit rien.
    expect((await alerts(autreCoach).expect(HttpStatus.OK)).body).toEqual([]);

    // Même calcul dans la vue d'ensemble et dans la fiche.
    const overview = await request(app.getHttpServer())
      .get('/api/coach/clients')
      .auth(token(coach, 'coach'), { type: 'bearer' })
      .expect(HttpStatus.OK);
    const ligne = (
      overview.body as { id: string; alertes: AlerteBody[] }[]
    ).find((row) => row.id === enEcart);
    expect(ligne?.alertes.map((a) => a.metrique)).toEqual([
      'poids',
      'calories',
    ]);
    const fiche = await request(app.getHttpServer())
      .get(`/api/coach/clients/${enEcart}`)
      .auth(token(coach, 'coach'), { type: 'bearer' })
      .expect(HttpStatus.OK);
    expect((fiche.body as { alertes: AlerteBody[] }).alertes).toHaveLength(2);
  });

  it('réinitialise la série de la métrique ajustée, et elle seule', async () => {
    const coach = await register('coach');
    const user = await register('utilisateur', coach);
    const plan = await seedEnEcart(user, coach);

    const budget = await patch(coach, plan.id, {
      budgetCalorique: 2500,
    }).expect(HttpStatus.OK);
    const ajuste = budget.body as PlanBody;
    expect(ajuste).toMatchObject({
      budgetCalorique: 2500,
      budgetPlafonneAuBmr: false,
      poidsCible: 75,
    });
    expect(ajuste.budgetAjusteLe).toBeDefined();
    expect(ajuste.poidsAjusteLe).toBeUndefined();

    let rows = (await alerts(coach).expect(HttpStatus.OK)).body as {
      alertes: AlerteBody[];
    }[];
    expect(rows[0].alertes.map((a) => a.metrique)).toEqual(['poids']);

    // Nouvel objectif sans budget saisi : budget recalculé, série poids remise à zéro.
    const objectif = await patch(coach, plan.id, { poidsCible: 76 }).expect(
      HttpStatus.OK,
    );
    const recalcule = objectif.body as PlanBody;
    expect(recalcule.poidsCible).toBe(76);
    expect(recalcule.budgetCalorique).not.toBe(2500);
    expect(recalcule.poidsAjusteLe).toBeDefined();
    rows = (await alerts(coach).expect(HttpStatus.OK)).body as {
      alertes: AlerteBody[];
    }[];
    expect(rows).toEqual([]);

    // Persisté dans le suivi : relu par la route de consultation.
    const relu = await request(app.getHttpServer())
      .get(`/api/plans/users/${user}`)
      .auth(token(coach, 'coach'), { type: 'bearer' })
      .expect(HttpStatus.OK);
    expect(relu.body as PlanBody).toMatchObject({
      id: plan.id,
      poidsCible: 76,
      budgetCalorique: recalcule.budgetCalorique,
    });
  });

  it('applique les règles de la création et les contrôles d’accès', async () => {
    const coach = await register('coach');
    const autreCoach = await register('coach');
    const user = await register('utilisateur', coach);
    const plan = await seedEnEcart(user, coach);

    const vide = await patch(coach, plan.id, {}).expect(HttpStatus.BAD_REQUEST);
    expect(slug(vide.body)).toBeDefined();
    await patch(coach, plan.id, { niveauActivite: 'sportif' }).expect(
      HttpStatus.BAD_REQUEST,
    );
    const tropRapide = await patch(coach, plan.id, {
      poidsCible: 60,
      dateCible: jourUtc(20),
    }).expect(HttpStatus.BAD_REQUEST);
    expect(slug(tropRapide.body)).toContain('invalid-plan');

    await patch(
      coach,
      plan.id,
      { budgetCalorique: 1700 },
      'utilisateur',
    ).expect(HttpStatus.FORBIDDEN);
    const etranger = await patch(autreCoach, plan.id, {
      budgetCalorique: 1700,
    }).expect(HttpStatus.FORBIDDEN);
    expect(slug(etranger.body)).toContain('forbidden');
    const inconnu = await patch(coach, randomUUID(), {
      budgetCalorique: 1700,
    }).expect(HttpStatus.NOT_FOUND);
    expect(slug(inconnu.body)).toContain('plan-not-found');

    // Rien n'a été modifié par les requêtes refusées.
    const intact = await request(app.getHttpServer())
      .get(`/api/plans/users/${user}`)
      .auth(token(coach, 'coach'), { type: 'bearer' })
      .expect(HttpStatus.OK);
    expect(intact.body as PlanBody).toMatchObject({
      poidsCible: 75,
      budgetCalorique: 1800,
    });

    await request(app.getHttpServer())
      .post(`/api/plans/${plan.id}/cancel`)
      .auth(token(coach, 'coach'), { type: 'bearer' })
      .expect(HttpStatus.OK);
    const annule = await patch(coach, plan.id, {
      budgetCalorique: 1700,
    }).expect(HttpStatus.CONFLICT);
    expect(slug(annule.body)).toContain('plan-not-active');
  });
});
