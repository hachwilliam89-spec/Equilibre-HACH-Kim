import assert from 'node:assert/strict';
import test from 'node:test';
import { simpleFaker } from '@faker-js/faker';
import {
  generateSteps,
  generateWeight,
  MAX_STEPS,
  readConfig,
  transmitDay,
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
  stepsEnabled: true,
  baseSteps: 8000,
  maxStepsVariation: 2500,
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

test('génère un nombre de pas entier et réaliste, borné à 50 000', () => {
  simpleFaker.seed(7);
  for (let i = 0; i < 50; i += 1) {
    const pas = generateSteps(config, simpleFaker);
    assert.ok(Number.isInteger(pas));
    assert.ok(pas >= 5500 && pas <= 10500);
  }
  assert.equal(
    generateSteps({ baseSteps: 49_000, maxStepsVariation: 5000 }, simpleFaker) <=
      MAX_STEPS,
    true,
  );
});

test('lit la configuration de la montre et permet de la désactiver', () => {
  const env = {
    SIMULATOR_API_URL: config.apiUrl,
    SIMULATOR_EMAIL: config.email,
    SIMULATOR_PASSWORD: config.password,
  };
  assert.equal(readConfig(env).stepsEnabled, true);
  assert.equal(readConfig(env).baseSteps, 8000);
  assert.equal(readConfig({ ...env, SIMULATOR_STEPS: 'false' }).stepsEnabled, false);
  assert.throws(
    () => readConfig({ ...env, SIMULATOR_BASE_STEPS: '-5' }),
    /SIMULATOR_BASE_STEPS/,
  );
});

function fakeApi(handlers) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: options?.body ? JSON.parse(options.body) : undefined });
    const path = new URL(url).pathname.replace(/^\/api/, '');
    const [status, body] = handlers[path] ?? [204, undefined];
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

const LOGIN = [
  200,
  { accessToken: 'access-token', refreshToken: 'refresh-token', role: 'utilisateur' },
];

test('envoie le poids puis les pas avec une seule session', async () => {
  const { calls, fetchImpl } = fakeApi({
    '/auth/login': LOGIN,
    '/measurements': [201, { statut: 'valide' }],
    '/activity/steps': [201, { jourUtc: '2026-10-20', nombrePas: 8123 }],
  });

  const result = await transmitDay(config, { poidsKg: 74.9, nombrePas: 8123 }, fetchImpl);

  assert.equal(result.measurement.statut, 'valide');
  assert.equal(result.steps.nombrePas, 8123);
  assert.deepEqual(
    calls.map(({ url }) => new URL(url).pathname),
    ['/api/auth/login', '/api/measurements', '/api/activity/steps', '/api/auth/logout'],
  );
  assert.deepEqual(calls[2].body, { nombrePas: 8123 });
});

test('envoie quand même les pas quand le poids du jour existe déjà (409)', async () => {
  const { calls, fetchImpl } = fakeApi({
    '/auth/login': LOGIN,
    '/measurements': [409, { detail: 'Mesure déjà enregistrée aujourd’hui' }],
    '/activity/steps': [201, { jourUtc: '2026-10-20', nombrePas: 9000 }],
  });

  const result = await transmitDay(config, { poidsKg: 74.9, nombrePas: 9000 }, fetchImpl);

  assert.equal(result.measurement, null);
  assert.match(result.conflict, /déjà enregistrée/);
  assert.equal(result.steps.nombrePas, 9000);
  assert.equal(new URL(calls.at(-1).url).pathname, '/api/auth/logout');
});

test('n’envoie pas de pas quand la montre est désactivée', async () => {
  const { calls, fetchImpl } = fakeApi({
    '/auth/login': LOGIN,
    '/measurements': [201, { statut: 'valide' }],
  });

  const result = await transmitDay(config, { poidsKg: 74.9 }, fetchImpl);

  assert.equal(result.steps, null);
  assert.ok(!calls.some(({ url }) => url.endsWith('/activity/steps')));
});
