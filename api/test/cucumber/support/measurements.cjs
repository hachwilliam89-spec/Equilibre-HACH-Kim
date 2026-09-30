require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Given, When, Then } = require('@cucumber/cucumber');
const request = require('supertest');

// Pas de hook Before/After ici : l'application, la connexion et le nettoyage
// des comptes (mesures incluses) sont fournis par le harnais partagé de
// plans.cjs (les hooks Cucumber sont globaux).

const suivis = (world) => world.connection.collection('suivis');

const sendWeight = (world, poidsKg) =>
  request(world.app.getHttpServer())
    .post('/api/measurements')
    .set('Authorization', `Bearer ${world.userToken}`)
    .send({ poidsKg });

async function insertValideHier(world, poidsKg, planId) {
  const received = new Date();
  received.setUTCDate(received.getUTCDate() - 1);
  const measurement = {
    id: randomUUID(),
    userId: world.userId,
    planId,
    poidsKg,
    receivedAt: received,
    jourUtc: received.toISOString().slice(0, 10),
    source: 'automatique',
    statut: 'valide',
  };
  await suivis(world).updateOne(
    { _id: world.userId },
    {
      $push: { mesures: measurement },
      $set: { derniereMesureValide: measurement },
      $inc: { version: 1 },
    },
  );
}

When("l'utilisatrice envoie un poids de {float} kg", async function (poidsKg) {
  this.response = await sendWeight(this, poidsKg);
});

When(
  "l'utilisatrice envoie simultanément deux poids valides",
  async function () {
    this.responses = await Promise.all([
      sendWeight(this, 71.5),
      sendWeight(this, 70.9),
    ]);
  },
);

// FR403-674
Given(
  'une mesure valide enregistrée hier pour cette utilisatrice',
  async function () {
    await insertValideHier(this, 72, this.planId);
  },
);

// FR403-672
Given(
  'une mesure valide de {float} kg enregistrée hier pour cette utilisatrice',
  async function (poidsKg) {
    await insertValideHier(this, poidsKg, this.planId);
  },
);

Given(
  'une mesure valide de {float} kg enregistrée hier sur un autre plan',
  async function (poidsKg) {
    await insertValideHier(this, poidsKg, randomUUID());
  },
);

Given('le plan actif demarre dans le futur', async function () {
  await suivis(this).updateOne(
    { _id: this.userId, 'planActif.id': this.planId },
    { $set: { 'planActif.dateDebut': new Date(Date.now() + 3 * 86400000) } },
  );
});

Then('la mesure est classee {string}', function (statut) {
  assert.equal(this.response.status, 201, this.response.text);
  assert.equal(this.response.body.statut, statut);
});

Then(
  'le conflit de mesure porte le type measurement-day-conflict',
  function () {
    assert.equal(this.response.status, 409, this.response.text);
    assert.match(
      this.response.body.type,
      /problems\/measurement-day-conflict$/,
    );
  },
);

Then("une réponse mesure vaut 201 et l'autre 409", function () {
  assert.deepEqual(this.responses.map((res) => res.status).sort(), [201, 409]);
});

Then(
  'le conflit simultané porte le type measurement-day-conflict',
  function () {
    const conflict = this.responses.find((res) => res.status === 409);
    assert.ok(conflict, 'aucune réponse 409 parmi les envois simultanés');
    assert.match(conflict.body.type, /problems\/measurement-day-conflict$/);
  },
);

Then(
  'la base contient {int} mesure(s) valide(s) pour cette utilisatrice',
  async function (count) {
    assert.equal(
      (await suivis(this).findOne({ _id: this.userId })).mesures.filter(
        (measurement) => measurement.statut === 'valide',
      ).length,
      count,
    );
  },
);

// FR403-675
const consulterSuivi = (world) =>
  request(world.app.getHttpServer())
    .get('/api/measurements/me/suivi')
    .set('Authorization', `Bearer ${world.userToken}`);

async function insertValideDecale(world, poidsKg, planId, offsetJours) {
  const received = new Date();
  received.setUTCDate(received.getUTCDate() + offsetJours);
  const measurement = {
    id: randomUUID(),
    userId: world.userId,
    planId,
    poidsKg,
    receivedAt: received,
    jourUtc: received.toISOString().slice(0, 10),
    source: 'automatique',
    statut: 'valide',
  };
  await suivis(world).updateOne(
    { _id: world.userId },
    {
      $push: { mesures: measurement },
      $set: { derniereMesureValide: measurement },
      $inc: { version: 1 },
    },
  );
}

Given(
  'une mesure valide de {float} kg enregistrée avant-hier pour cette utilisatrice',
  async function (poidsKg) {
    await insertValideDecale(this, poidsKg, this.planId, -2);
  },
);

When("l'utilisatrice consulte son suivi de poids", async function () {
  this.response = await consulterSuivi(this);
});

Then('le statut de suivi est {string}', function (statut) {
  assert.equal(this.response.status, 200, this.response.text);
  assert.equal(this.response.body.statut, statut);
});

Then('le suivi renvoie le resume du plan actif', function () {
  assert.ok(this.response.body.plan, 'resume du plan absent');
  assert.equal(this.response.body.plan.id, this.planId);
});

// FR403-670
When(
  "l'utilisatrice envoie une correction manuelle de {float} kg",
  async function (poidsKg) {
    this.response = await request(this.app.getHttpServer())
      .post('/api/measurements/correction')
      .set('Authorization', `Bearer ${this.userToken}`)
      .send({ poidsKg });
  },
);

Given('une mesure suspecte du jour pour cette utilisatrice', async function () {
  const received = new Date();
  await suivis(this).updateOne(
    { _id: this.userId },
    {
      $push: {
        mesures: {
          id: randomUUID(),
          userId: this.userId,
          planId: this.planId,
          poidsKg: 90,
          receivedAt: received,
          jourUtc: received.toISOString().slice(0, 10),
          source: 'automatique',
          statut: 'suspecte',
        },
      },
      $inc: { version: 1 },
    },
  );
});
