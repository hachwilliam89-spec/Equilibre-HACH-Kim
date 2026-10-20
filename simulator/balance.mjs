import { simpleFaker } from '@faker-js/faker';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Borne de l'API : au-delà, le nombre de pas est refusé comme aberrant. */
export const MAX_STEPS = 50_000;

export class SimulatorHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function positiveNumber(value, name, fallback) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} doit être un nombre strictement positif.`);
  }
  return parsed;
}

export function readConfig(env = process.env) {
  const apiUrl = env.SIMULATOR_API_URL?.replace(/\/$/, '');
  const email = env.SIMULATOR_EMAIL?.trim();
  const password = env.SIMULATOR_PASSWORD;
  if (!apiUrl || !email || !password) {
    throw new Error(
      'SIMULATOR_API_URL, SIMULATOR_EMAIL et SIMULATOR_PASSWORD sont requis.',
    );
  }
  const url = new URL(apiUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SIMULATOR_API_URL doit utiliser HTTP ou HTTPS.');
  }
  const mode = env.SIMULATOR_MODE ?? 'normal';
  if (!['normal', 'suspect'].includes(mode)) {
    throw new Error('SIMULATOR_MODE doit valoir normal ou suspect.');
  }
  const seed = env.SIMULATOR_SEED
    ? positiveNumber(env.SIMULATOR_SEED, 'SIMULATOR_SEED')
    : undefined;
  return {
    apiUrl,
    email,
    password,
    baseWeightKg: positiveNumber(
      env.SIMULATOR_BASE_WEIGHT_KG,
      'SIMULATOR_BASE_WEIGHT_KG',
      75,
    ),
    maxDailyVariationKg: positiveNumber(
      env.SIMULATOR_MAX_DAILY_VARIATION_KG,
      'SIMULATOR_MAX_DAILY_VARIATION_KG',
      0.4,
    ),
    intervalMs: positiveNumber(
      env.SIMULATOR_INTERVAL_MS,
      'SIMULATOR_INTERVAL_MS',
      DAY_MS,
    ),
    mode,
    seed,
    // US4 : la montre simulée envoie aussi les pas, sauf SIMULATOR_STEPS=false.
    stepsEnabled: env.SIMULATOR_STEPS !== 'false',
    baseSteps: positiveNumber(env.SIMULATOR_BASE_STEPS, 'SIMULATOR_BASE_STEPS', 8000),
    maxStepsVariation: positiveNumber(
      env.SIMULATOR_MAX_STEPS_VARIATION,
      'SIMULATOR_MAX_STEPS_VARIATION',
      2500,
    ),
  };
}

/** Total de pas réaliste du jour, entier entre 0 et MAX_STEPS. */
export function generateSteps(
  { baseSteps, maxStepsVariation },
  faker = simpleFaker,
) {
  const variation = faker.number.int({
    min: -Math.round(maxStepsVariation),
    max: Math.round(maxStepsVariation),
  });
  return Math.min(MAX_STEPS, Math.max(0, Math.round(baseSteps + variation)));
}

export function generateWeight(
  { baseWeightKg, maxDailyVariationKg, mode },
  faker = simpleFaker,
) {
  const variation =
    mode === 'suspect'
      ? faker.number.float({ min: 3.1, max: 5, fractionDigits: 1 }) *
        faker.helpers.arrayElement([-1, 1])
      : faker.number.float({
          min: -maxDailyVariationKg,
          max: maxDailyVariationKg,
          fractionDigits: 1,
        });
  return Math.max(0.1, Math.round((baseWeightKg + variation) * 10) / 10);
}

async function jsonResponse(response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new SimulatorHttpError(
      response.status,
      `Réponse non JSON reçue de l’API (${response.status}).`,
    );
  }
}

async function request(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const body = await jsonResponse(response);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'detail' in body
        ? String(body.detail)
        : `Appel API refusé (${response.status}).`;
    throw new SimulatorHttpError(response.status, message);
  }
  return body;
}

/** Ouvre une session utilisateur, exécute les envois, puis la révoque. */
async function withSession(config, fetchImpl, send) {
  const login = await request(fetchImpl, `${config.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  if (
    !login ||
    typeof login !== 'object' ||
    !('accessToken' in login) ||
    !('refreshToken' in login)
  ) {
    throw new Error('La réponse de connexion est invalide.');
  }

  try {
    if (login.role !== 'utilisateur') {
      throw new Error('Le compte configuré doit avoir le rôle utilisateur.');
    }
    const post = (path, body) =>
      request(fetchImpl, `${config.apiUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${login.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    return await send(post);
  } finally {
    await fetchImpl(`${config.apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: login.refreshToken }),
    }).catch(() => undefined);
  }
}

export async function transmitWeight(config, poidsKg, fetchImpl = fetch) {
  return withSession(config, fetchImpl, (post) =>
    post('/measurements', { poidsKg }),
  );
}

/**
 * Envoi quotidien de la balance et de la montre avec une seule session.
 * Un conflit sur le poids (mesure déjà enregistrée) n'empêche pas l'envoi
 * des pas. nombrePas absent : montre désactivée.
 */
export async function transmitDay(
  config,
  { poidsKg, nombrePas },
  fetchImpl = fetch,
) {
  return withSession(config, fetchImpl, async (post) => {
    let measurement = null;
    let conflict = null;
    try {
      measurement = await post('/measurements', { poidsKg });
    } catch (error) {
      if (!(error instanceof SimulatorHttpError) || error.status !== 409) {
        throw error;
      }
      conflict = error.message;
    }
    const steps =
      nombrePas === undefined
        ? null
        : await post('/activity/steps', { nombrePas });
    return { measurement, conflict, steps };
  });
}

export async function run(config, { once = false, signal } = {}) {
  if (config.seed !== undefined) simpleFaker.seed(config.seed);
  let referenceWeightKg = config.baseWeightKg;
  do {
    const poidsKg = generateWeight(
      { ...config, baseWeightKg: referenceWeightKg },
      simpleFaker,
    );
    const nombrePas = config.stepsEnabled
      ? generateSteps(config, simpleFaker)
      : undefined;
    const { measurement, conflict, steps } = await transmitDay(config, {
      poidsKg,
      nombrePas,
    });
    if (measurement) {
      referenceWeightKg = poidsKg;
      console.log(
        `[balance] ${new Date().toISOString()} — ${poidsKg.toFixed(1)} kg envoyés — statut ${measurement.statut}`,
      );
    } else {
      console.log(`[balance] ${conflict} Aucun doublon créé.`);
    }
    if (steps) {
      console.log(
        `[montre] ${steps.jourUtc} — ${steps.nombrePas} pas envoyés`,
      );
    }
    if (once) return;
    console.log(
      `[balance] prochain envoi dans ${(config.intervalMs / 3_600_000).toFixed(2)} h`,
    );
    await delay(config.intervalMs, undefined, { signal });
  } while (!signal?.aborted);
}

async function main() {
  const config = readConfig();
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  try {
    await run(config, {
      once: process.argv.includes('--once'),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.error(
      `[balance] échec : ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
