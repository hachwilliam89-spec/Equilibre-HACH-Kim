require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Given, When, Then } = require('@cucumber/cucumber');
const request = require('supertest');

// Pas de hook Before/After ici : l'application, la connexion et le nettoyage
// des comptes sont fournis par le harnais partagé de plans.cjs (les hooks
// Cucumber sont globaux). Le nettoyage des mesures est ajouté dans son After.

const measurements = (world) => world.connection.collection('measurements');
const sendWeight = (world, poidsKg) =>
  request(world.app.getHttpServer())
    .post('/api/measurements')
    .set('Authorization', `Bearer ${world.userToken}`)
    .send({ poidsKg });

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

Given(
  'une mesure valide enregistrée hier pour cette utilisatrice',
  async function () {
    const received = new Date();
    received.setUTCDate(received.getUTCDate() - 1);
    await measurements(this).insertOne({
      _id: randomUUID(),
      userId: this.userId,
      planId: this.planId,
      poidsKg: 72,
      receivedAt: received,
      jourUtc: received.toISOString().slice(0, 10),
      source: 'automatique',
      statut: 'valide',
    });
  },
);

Then(
  'le conflit de mesure porte le type measurement-day-conflict',
  function () {
    assert.equal(this.response.status, 409, this.response.text);
    assert.match(this.response.body.type, /problems\/measurement-day-conflict$/);
  },
);

Then(
  'une réponse mesure vaut 201 et l\'autre 409',
  function () {
    assert.deepEqual(
      this.responses.map((res) => res.status).sort(),
      [201, 409],
    );
  },
);

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
      await measurements(this).countDocuments({
        userId: this.userId,
        statut: 'valide',
      }),
      count,
    );
  },
);
