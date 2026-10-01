import assert from 'node:assert/strict';
import test from 'node:test';
import { simpleFaker } from '@faker-js/faker';
import {
  generateWeight,
  readConfig,
  transmitWeight,
} from './balance.mjs';

const config = {
  apiUrl: 'https://api.example.test/api',
  email: 'user@example.test',
  password: 'secret-password',
  baseWeightKg: 75,
  maxDailyVariationKg: 0.4,
  intervalMs: 86_400_000,
  mode: 'normal',
};

test('génère un poids normal réaliste et arrondi au dixième', () => {
  simpleFaker.seed(42);
  const poids = generateWeight(config, simpleFaker);
  assert.ok(poids >= 74.6 && poids <= 75.4);
  assert.equal(poids * 10, Math.round(poids * 10));
});

test('génère volontairement une variation suspecte supérieure à 3 kg', () => {
  simpleFaker.seed(42);
  const poids = generateWeight({ ...config, mode: 'suspect' }, simpleFaker);
  assert.ok(Math.abs(poids - config.baseWeightKg) > 3);
});

test('valide les variables requises sans fournir de valeur par défaut aux secrets', () => {
  assert.throws(() => readConfig({}), /sont requis/);
  assert.equal(
    readConfig({
      SIMULATOR_API_URL: config.apiUrl,
      SIMULATOR_EMAIL: config.email,
      SIMULATOR_PASSWORD: config.password,
    }).baseWeightKg,
    75,
  );
});

test('se connecte, envoie la mesure automatique puis révoque la session', async () => {
  const calls = [];
  const responses = [
    {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      role: 'utilisateur',
    },
    { id: 'measurement-id', poidsKg: 74.9, statut: 'valide' },
    undefined,
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const body = responses.shift();
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status: body === undefined ? 204 : url.endsWith('/measurements') ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await transmitWeight(config, 74.9, fetchImpl);

  assert.equal(result.statut, 'valide');
  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      `${config.apiUrl}/auth/login`,
      `${config.apiUrl}/measurements`,
      `${config.apiUrl}/auth/logout`,
    ],
  );
  assert.deepEqual(JSON.parse(calls[1].options.body), { poidsKg: 74.9 });
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');
});

test('propage le conflit journalier et révoque quand même la session', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    if (url.endsWith('/auth/login')) {
      return new Response(
        JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          role: 'utilisateur',
        }),
        { status: 200 },
      );
    }
    if (url.endsWith('/measurements')) {
      return new Response(
        JSON.stringify({ detail: 'Mesure déjà enregistrée aujourd’hui' }),
        { status: 409 },
      );
    }
    return new Response(null, { status: 204 });
  };

  await assert.rejects(
    () => transmitWeight(config, 74.9, fetchImpl),
    (error) => error.status === 409,
  );
  assert.equal(calls.at(-1), `${config.apiUrl}/auth/logout`);
});
