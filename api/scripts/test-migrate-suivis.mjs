import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

const sourceUri = process.env.MONGO_URI;
if (!sourceUri) throw new Error('MONGO_URI est obligatoire');

const parsedUri = new URL(sourceUri);
parsedUri.pathname = '/equilibre_migration_test';
const uri = parsedUri.toString();
const userId = randomUUID();
const coachId = randomUUID();
const planId = randomUUID();
const measurementId = randomUUID();
const migratedUserId = randomUUID();
const now = new Date();

const runMigration = (...args) =>
  execFileSync(process.execPath, ['scripts/migrate-suivis.mjs', ...args], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, MONGO_URI: uri },
    encoding: 'utf8',
  });

await mongoose.connect(uri);
try {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Connexion MongoDB indisponible');
  await db.dropDatabase();
  await db.collection('users').insertOne({
    _id: userId,
    email: 'migration@equilibre.test',
    passwordHash: 'hash',
    role: 'utilisateur',
    coachId,
    tailleCm: 170,
    age: 30,
    sexe: 'femme',
  });
  await db.collection('plans').insertOne({
    _id: planId,
    userId,
    coachId,
    poidsDepart: 80,
    poidsCible: 75,
    dateDebut: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    dateCible: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1),
    ),
    imcCible: 25.95,
    niveauActivite: 'actif',
    budgetCalorique: 1900,
    budgetPlafonneAuBmr: false,
    statut: 'actif',
    createdAt: now,
  });
  await db.collection('measurements').insertOne({
    _id: measurementId,
    userId,
    planId,
    poidsKg: 79.5,
    receivedAt: now,
    jourUtc: now.toISOString().slice(0, 10),
    source: 'automatique',
    statut: 'valide',
  });

  // Utilisateur déjà passé sur la nouvelle API : son document suivis est
  // plus récent que ses anciens plans et ne doit pas être remplacé.
  await db.collection('users').insertOne({
    _id: migratedUserId,
    email: 'deja-migre@equilibre.test',
    passwordHash: 'hash',
    role: 'utilisateur',
    coachId,
    profil: { tailleCm: 175 },
  });
  await db.collection('plans').insertOne({
    _id: randomUUID(),
    userId: migratedUserId,
    coachId,
    poidsDepart: 70,
    poidsCible: 68,
    dateDebut: now,
    dateCible: now,
    imcCible: 22,
    niveauActivite: 'actif',
    budgetCalorique: 1800,
    budgetPlafonneAuBmr: false,
    statut: 'annule',
    createdAt: now,
  });
  await db.collection('suivis').insertOne({
    _id: migratedUserId,
    version: 14,
    planActif: null,
    plans: [],
    mesures: [],
    journauxAlimentaires: [{ jourUtc: '2026-10-08' }],
  });

  await mongoose.disconnect();
  runMigration();

  await mongoose.connect(uri);
  assert.equal(
    await mongoose.connection.db.collection('suivis').countDocuments(),
    1,
  );
  await mongoose.disconnect();

  runMigration('--apply');
  runMigration('--apply');

  await mongoose.connect(uri);
  const appliedDb = mongoose.connection.db;
  const suivi = await appliedDb.collection('suivis').findOne({ _id: userId });
  const user = await appliedDb.collection('users').findOne({ _id: userId });
  assert.equal(await appliedDb.collection('suivis').countDocuments(), 2);
  const preserved = await appliedDb
    .collection('suivis')
    .findOne({ _id: migratedUserId });
  assert.equal(preserved.version, 14);
  assert.equal(preserved.journauxAlimentaires.length, 1);
  assert.equal(suivi.planActif.id, planId);
  assert.equal(suivi.mesures[0].id, measurementId);
  assert.equal(suivi.derniereMesureValide.id, measurementId);
  assert.equal(user.profil.tailleCm, 170);
  assert.equal('tailleCm' in user, false);
  await mongoose.disconnect();

  runMigration('--apply', '--drop-legacy');
  await mongoose.connect(uri);
  const collections = (
    await mongoose.connection.db.listCollections().toArray()
  ).map((collection) => collection.name);
  assert.equal(collections.includes('plans'), false);
  assert.equal(collections.includes('measurements'), false);
  assert.equal(collections.includes('suivis'), true);
  console.log('Migration suivis vérifiée sur une base isolée.');
} finally {
  if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
}
