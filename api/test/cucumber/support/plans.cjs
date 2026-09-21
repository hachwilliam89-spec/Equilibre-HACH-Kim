require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  Before,
  After,
  Given,
  When,
  Then,
  setDefaultTimeout,
} = require('@cucumber/cucumber');
const { Test } = require('@nestjs/testing');
const { getConnectionToken } = require('@nestjs/mongoose');
const request = require('supertest');
const { AppModule } = require('../../../dist/app.module');

setDefaultTimeout(30000);

const day = (offset) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const body = (world, depart = 80, cible = 75, jours = 35) => ({
  userId: world.userId,
  poidsDepart: depart,
  poidsCible: cible,
  dateDebut: day(0),
  dateCible: day(jours),
  niveauActivite: 'sportif',
  ...(world.manualBudget === undefined
    ? {}
    : { budgetCalorique: world.manualBudget }),
});
const api = (world) => request(world.app.getHttpServer());
const submit = (world, payload) =>
  api(world)
    .post('/api/plans')
    .set('Authorization', `Bearer ${world.coachToken}`)
    .send(payload);

Before(async function () {
  if (
    process.env.NODE_ENV !== 'test' ||
    !/\/equilibre_test(?:\?|$)/.test(process.env.MONGO_URI || '')
  ) {
    throw new Error('Cucumber exige NODE_ENV=test et la base equilibre_test.');
  }
  this.accountIds = [];
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  this.app = module.createNestApplication();
  this.app.setGlobalPrefix('api');
  await this.app.init();
  this.connection = this.app.get(getConnectionToken());
  this.plans = this.connection.collection('plans');
});

After(async function () {
  try {
    if (this.connection && this.accountIds.length) {
      // Nettoyage limité aux comptes de ce scénario, jamais à toute la base.
      await this.plans.deleteMany({ userId: { $in: this.accountIds } });
      await this.connection
        .collection('refresh_tokens')
        .deleteMany({ userId: { $in: this.accountIds } });
      await this.connection
        .collection('users')
        .deleteMany({ _id: { $in: this.accountIds } });
    }
  } finally {
    if (this.app) await this.app.close();
  }
});

async function account(world, extra) {
  const credentials = {
    email: `cucumber-${randomUUID()}@equilibre.test`,
    password: 'Password-test-123',
  };
  const registration = await api(world)
    .post('/api/auth/register')
    .send({ ...credentials, ...extra })
    .expect(201);
  world.accountIds.push(registration.body.userId);
  const login = await api(world)
    .post('/api/auth/login')
    .send(credentials)
    .expect(200);
  return { id: registration.body.userId, token: login.body.accessToken };
}

Given(
  'un coach authentifié et une utilisatrice rattachée de 30 ans mesurant 170 cm',
  async function () {
    const coach = await account(this, { role: 'coach' });
    this.coachToken = coach.token;
    this.coachId = coach.id;
    this.tailleCm = 170;
    const user = await account(this, {
      role: 'utilisateur',
      coachId: coach.id,
      age: 30,
      sexe: 'femme',
      tailleCm: 170,
    });
    this.userId = user.id;
    this.userToken = user.token;
  },
);
Given('une taille de {int} cm dans le profil', async function (tailleCm) {
  this.tailleCm = tailleCm;
  await this.connection
    .collection('users')
    .updateOne({ _id: this.userId }, { $set: { tailleCm } });
});
Given('un budget manuel de {int} kcal', function (budget) {
  this.manualBudget = budget;
});
Given('un autre coach authentifié', async function () {
  this.coachToken = (await account(this, { role: 'coach' })).token;
});
When(
  'le coach soumet un plan de {int} kg vers {int} kg sur {int} jours',
  async function (depart, cible, jours) {
    this.response = await submit(this, body(this, depart, cible, jours));
  },
);
Then('le code HTTP est {int}', function (code) {
  assert.equal(this.response.status, code, this.response.text);
});
Then(
  'la base contient {int} plan pour cette utilisatrice',
  async function (count) {
    assert.equal(
      await this.plans.countDocuments({ userId: this.userId }),
      count,
    );
    if (this.response?.status === 201) {
      const saved = await this.plans.findOne({ _id: this.response.body.id });
      assert.ok(saved);
      for (const result of [saved, this.response.body]) {
        assert.equal(result.statut, 'actif');
        assert.equal(result.userId, this.userId);
        assert.equal(result.coachId, this.coachId);
        assert.ok(
          Math.abs(
            result.imcCible - result.poidsCible / (this.tailleCm / 100) ** 2,
          ) < 0.000001,
        );
      }
      assert.equal(
        await this.plans.countDocuments({
          userId: this.userId,
          statut: 'actif',
        }),
        1,
      );
      assert.equal(saved.poidsCible, this.response.body.poidsCible);
    }
  },
);
Then("l'IMC cible retourné et enregistré vaut {float}", async function (imc) {
  const saved = await this.plans.findOne({ _id: this.response.body.id });
  assert.equal(this.response.body.imcCible, imc);
  assert.equal(saved.imcCible, imc);
});
Then(
  'le budget retourné et enregistré vaut {float} kcal avec un plancher {word}',
  async function (budget, flag) {
    const saved = await this.plans.findOne({ _id: this.response.body.id });
    for (const result of [saved, this.response.body]) {
      assert.ok(Math.abs(result.budgetCalorique - budget) < 0.000001);
      assert.equal(result.budgetPlafonneAuBmr, flag === 'oui');
    }
  },
);
When('le coach soumet simultanément deux plans valides', async function () {
  this.responses = await Promise.all([
    submit(this, body(this)),
    submit(this, body(this)),
  ]);
});
Then("une réponse vaut 201 et l'autre 409", async function () {
  assert.deepEqual(this.responses.map((res) => res.status).sort(), [201, 409]);
  assert.equal(
    await this.plans.countDocuments({ userId: this.userId, statut: 'actif' }),
    1,
  );
  const index = (await this.plans.indexes()).find(
    (entry) => entry.name === 'one_active_plan_per_user',
  );
  assert.ok(index);
  assert.equal(index.unique, true);
  assert.deepEqual(index.partialFilterExpression, { statut: 'actif' });
});
When("l'utilisatrice et son coach consultent le plan actif", async function () {
  this.responses = await Promise.all([
    api(this)
      .get('/api/plans/me')
      .set('Authorization', `Bearer ${this.userToken}`),
    api(this)
      .get(`/api/plans/users/${this.userId}`)
      .set('Authorization', `Bearer ${this.coachToken}`),
  ]);
});
Then('les deux réponses valent 200 avec le corps JSON null', function () {
  for (const res of this.responses) {
    assert.equal(res.status, 200);
    assert.equal(res.text, 'null');
    assert.equal(res.body, null);
    assert.match(res.headers['content-type'], /application\/json/);
  }
});
async function existingPlan(world, offset) {
  const res = await submit(world, body(world)).expect(201);
  world.planId = res.body.id;
  if (offset !== undefined)
    await world.plans.updateOne(
      { _id: world.planId },
      { $set: { dateCible: new Date(day(offset)) } },
    );
}
Given('un plan actif enregistré', async function () {
  await existingPlan(this);
});
Given(
  "un plan actif enregistré dont la date cible est aujourd'hui",
  async function () {
    await existingPlan(this, 0);
  },
);
Given(
  'un plan actif enregistré dont la date cible était hier',
  async function () {
    await existingPlan(this, -1);
  },
);
When('le coach annule ce plan', async function () {
  this.response = await api(this)
    .post(`/api/plans/${this.planId}/cancel`)
    .set('Authorization', `Bearer ${this.coachToken}`);
});
When('le coach consulte le plan actif', async function () {
  this.response = await api(this)
    .get(`/api/plans/users/${this.userId}`)
    .set('Authorization', `Bearer ${this.coachToken}`);
});
Then('le statut enregistré vaut {string}', async function (statut) {
  assert.equal((await this.plans.findOne({ _id: this.planId })).statut, statut);
});
Then('le statut retourné et enregistré vaut {string}', async function (statut) {
  assert.equal(this.response.body.statut, statut);
  assert.equal((await this.plans.findOne({ _id: this.planId })).statut, statut);
});

async function preview(world, token, payload) {
  world.plansBeforePreview = await world.plans
    .find({ userId: world.userId })
    .sort({ _id: 1 })
    .toArray();
  const req = api(world).post('/api/plans/preview');
  if (token) req.set('Authorization', `Bearer ${token}`);
  world.response = await req.send(payload);
}
When(
  'le coach demande une proposition de {int} kg vers {int} kg sur {int} jours',
  async function (depart, cible, jours) {
    await preview(this, this.coachToken, body(this, depart, cible, jours));
  },
);
When(
  'une proposition est demandée avec un accès {word}',
  async function (acces) {
    assert.ok(['anonyme', 'utilisateur'].includes(acces));
    await preview(
      this,
      acces === 'utilisateur' ? this.userToken : null,
      body(this),
    );
  },
);
Then(
  "aucun document de plan n'a été modifié par la proposition",
  async function () {
    assert.deepEqual(
      await this.plans.find({ userId: this.userId }).sort({ _id: 1 }).toArray(),
      this.plansBeforePreview,
    );
  },
);
Then(
  'la proposition vaut {float} kcal avec un avertissement {word}',
  function (budget, flag) {
    const result = this.response.body;
    assert.ok(Math.abs(result.budgetCalorique - budget) < 0.000001);
    assert.equal(result.budgetPlafonneAuBmr, flag === 'oui');
    if (flag === 'oui') assert.match(result.avertissement, /BMR/);
    else assert.equal(result.avertissement, null);
    assert.equal(result.userId, this.userId);
    assert.ok(
      Math.abs(
        result.imcCible - result.poidsCible / (this.tailleCm / 100) ** 2,
      ) < 0.000001,
    );
    assert.equal(Object.hasOwn(result, 'id'), false);
    assert.equal(Object.hasOwn(result, 'statut'), false);
  },
);
Given('un profil sans âge ni sexe', async function () {
  await this.connection
    .collection('users')
    .updateOne({ _id: this.userId }, { $unset: { age: '', sexe: '' } });
});
