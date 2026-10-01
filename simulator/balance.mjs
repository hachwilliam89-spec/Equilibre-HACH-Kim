import { simpleFaker } from '@faker-js/faker';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  };
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

export async function transmitWeight(config, poidsKg, fetchImpl = fetch) {
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
    return await request(fetchImpl, `${config.apiUrl}/measurements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ poidsKg }),
    });
  } finally {
    await fetchImpl(`${config.apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: login.refreshToken }),
    }).catch(() => undefined);
  }
}

export async function run(config, { once = false, signal } = {}) {
  if (config.seed !== undefined) simpleFaker.seed(config.seed);
  let referenceWeightKg = config.baseWeightKg;
  do {
    const poidsKg = generateWeight(
      { ...config, baseWeightKg: referenceWeightKg },
      simpleFaker,
    );
    try {
      const measurement = await transmitWeight(config, poidsKg);
      referenceWeightKg = poidsKg;
      console.log(
        `[balance] ${new Date().toISOString()} — ${poidsKg.toFixed(1)} kg envoyés — statut ${measurement.statut}`,
      );
    } catch (error) {
      if (error instanceof SimulatorHttpError && error.status === 409) {
        console.log(`[balance] ${error.message} Aucun doublon créé.`);
      } else {
        throw error;
      }
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
