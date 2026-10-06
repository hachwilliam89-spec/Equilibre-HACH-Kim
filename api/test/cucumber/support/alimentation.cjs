require('reflect-metadata');
const assert = require('node:assert/strict');
const { When, Then } = require('@cucumber/cucumber');
const request = require('supertest');

// Le harnais (app Nest, connexion Mongo, creation du coach/utilisatrice,
// plan actif, budget manuel, nettoyage des comptes) est fourni par plans.cjs :
// les hooks et les Given de contexte sont globaux et reutilises ici.

const api = (world) => request(world.app.getHttpServer());

// Recherche par nom dans la librairie (US3 : pas d'aliment personnalise), puis
// renvoie l'identifiant de l'aliment exact pour le consigner.
async function findFoodId(world, nom) {
  const res = await api(world)
    .get('/api/foods')
    .query({ q: nom })
    .set('Authorization', `Bearer ${world.userToken}`)
    .expect(200);
  const exact = res.body.find((food) => food.nom === nom);
  return (exact || res.body[0]).id;
}

When(
  "l'utilisatrice consigne {int} g de {string}",
  async function (quantiteGrammes, nom) {
    const foodId = await findFoodId(this, nom);
    this.response = await api(this)
      .post('/api/food-journals/me/entries')
      .set('Authorization', `Bearer ${this.userToken}`)
      .send({ foodId, quantiteGrammes });
    if (this.response.status === 201) {
      const entrees = this.response.body.entrees;
      this.lastEntryId = entrees[entrees.length - 1].id;
    }
  },
);

When("l'utilisatrice recherche l'aliment {string}", async function (nom) {
  this.response = await api(this)
    .get('/api/foods')
    .query({ q: nom })
    .set('Authorization', `Bearer ${this.userToken}`);
});

When(
  "l'utilisatrice retire la dernière entrée consignée",
  async function () {
    this.response = await api(this)
      .delete(`/api/food-journals/me/entries/${this.lastEntryId}`)
      .set('Authorization', `Bearer ${this.userToken}`);
  },
);

When("l'utilisatrice consulte son statut alimentaire", async function () {
  this.response = await api(this)
    .get('/api/food-journals/me/status')
    .set('Authorization', `Bearer ${this.userToken}`);
});

When(
  "l'utilisatrice tente de créer un aliment dans la librairie",
  async function () {
    this.response = await api(this)
      .post('/api/foods')
      .set('Authorization', `Bearer ${this.userToken}`)
      .send({ nom: 'Aliment interdit' });
  },
);

Then(
  "l'entrée consignée vaut {int} kcal, {float} g de protéines, {float} g de glucides et {float} g de lipides",
  function (kcal, prot, gluc, lip) {
    assert.equal(this.response.status, 201, this.response.text);
    const entree = this.response.body.entrees.at(-1);
    assert.equal(entree.caloriesKcal, kcal);
    assert.equal(entree.proteinesG, prot);
    assert.equal(entree.glucidesG, gluc);
    assert.equal(entree.lipidesG, lip);
  },
);

Then("le journal du jour totalise {int} kcal", function (kcal) {
  assert.equal(this.response.body.totalCaloriesKcal, kcal);
});

Then("la recherche ne renvoie aucun aliment", function () {
  assert.deepEqual(this.response.body, []);
});

Then("le statut alimentaire est {string}", function (statut) {
  assert.equal(this.response.status, 200, this.response.text);
  assert.equal(this.response.body.statut, statut);
});

Then("l'écart calorique vaut {int} kcal", function (ecart) {
  assert.equal(this.response.body.ecartKcal, ecart);
});
