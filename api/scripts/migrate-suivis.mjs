import mongoose from 'mongoose';

const apply = process.argv.includes('--apply');
const dropLegacy = process.argv.includes('--drop-legacy');
const uri = process.env.MONGO_URI;

if (!uri) throw new Error('MONGO_URI est obligatoire');
if (dropLegacy && !apply) {
  throw new Error('--drop-legacy exige --apply');
}

const threeMonthsBeforeUtc = (date) => {
  const month = date.getUTCMonth() - 3;
  const year = date.getUTCFullYear() + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, normalizedMonth, Math.min(date.getUTCDate(), lastDay)),
  );
};

const planToEmbedded = (plan) => ({
  id: String(plan._id),
  userId: plan.userId,
  coachId: plan.coachId,
  poidsDepart: plan.poidsDepart,
  poidsCible: plan.poidsCible,
  dateDebut: plan.dateDebut,
  dateCible: plan.dateCible,
  imcCible: plan.imcCible,
  niveauActivite: plan.niveauActivite,
  budgetCalorique: plan.budgetCalorique,
  budgetPlafonneAuBmr: plan.budgetPlafonneAuBmr,
  statut: plan.statut,
  createdAt: plan.createdAt,
});

const measurementToEmbedded = (measurement) => ({
  id: String(measurement._id),
  userId: measurement.userId,
  planId: measurement.planId,
  poidsKg: measurement.poidsKg,
  receivedAt: measurement.receivedAt,
  jourUtc: measurement.jourUtc,
  source: measurement.source,
  statut: measurement.statut,
});

await mongoose.connect(uri);
try {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Connexion MongoDB indisponible');
  const users = db.collection('users');
  const plans = db.collection('plans');
  const measurements = db.collection('measurements');
  const suivis = db.collection('suivis');
  const now = new Date();
  const cutoff = threeMonthsBeforeUtc(now);

  const [allUsers, allPlans, allMeasurements] = await Promise.all([
    users.find({}).toArray(),
    plans.find({}).toArray(),
    measurements.find({}).toArray(),
  ]);
  const userIds = new Set([
    ...allPlans.map((plan) => plan.userId),
    ...allMeasurements.map((measurement) => measurement.userId),
  ]);
  const replacements = [];
  const existingUserIds = new Set(allUsers.map((user) => String(user._id)));

  for (const userId of userIds) {
    if (!existingUserIds.has(userId)) {
      throw new Error(`${userId}: utilisateur référencé mais introuvable`);
    }
    const userPlans = allPlans.filter((plan) => plan.userId === userId);
    const activePlans = userPlans.filter((plan) => plan.statut === 'actif');
    if (activePlans.length > 1) {
      throw new Error(`${userId}: plusieurs plans actifs détectés`);
    }
    const activePlan = activePlans[0] ?? null;
    const allUserMeasurements = allMeasurements
      .filter((measurement) => measurement.userId === userId)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const userPlanIds = new Set(userPlans.map((plan) => String(plan._id)));
    const orphanMeasurement = allUserMeasurements.find(
      (measurement) => !userPlanIds.has(measurement.planId),
    );
    if (orphanMeasurement) {
      throw new Error(
        `${userId}: mesure ${String(orphanMeasurement._id)} sans plan associé`,
      );
    }
    const recentMeasurements = allUserMeasurements.filter(
      (measurement) => measurement.receivedAt >= cutoff,
    );
    if (recentMeasurements.length > 1000) {
      throw new Error(
        `${userId}: ${recentMeasurements.length} mesures récentes, maximum 1000`,
      );
    }
    const referencedPlanIds = new Set(
      recentMeasurements.map((measurement) => measurement.planId),
    );
    const pastPlans = userPlans.filter(
      (plan) =>
        plan.statut !== 'actif' && referencedPlanIds.has(String(plan._id)),
    );
    const latestValid = activePlan
      ? (allUserMeasurements.find(
          (measurement) =>
            measurement.planId === String(activePlan._id) &&
            measurement.statut === 'valide',
        ) ?? null)
      : null;
    const today = now.toISOString().slice(0, 10);
    const blocking = recentMeasurements.find(
      (measurement) =>
        measurement.jourUtc === today &&
        (measurement.statut === 'valide' || measurement.source === 'manuelle'),
    );
    replacements.push({
      _id: userId,
      version: 0,
      planActif: activePlan ? planToEmbedded(activePlan) : null,
      plans: pastPlans.map(planToEmbedded),
      mesures: recentMeasurements.map(measurementToEmbedded),
      derniereMesureValide: latestValid
        ? measurementToEmbedded(latestValid)
        : null,
      blocageJournalier: blocking
        ? { jourUtc: blocking.jourUtc, mesureId: String(blocking._id) }
        : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const profiles = allUsers.filter(
    (user) =>
      !user.profil &&
      (user.tailleCm !== undefined ||
        user.age !== undefined ||
        user.sexe !== undefined),
  );
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        suivis: replacements.length,
        profils: profiles.length,
        mesuresConservees: replacements.reduce(
          (total, suivi) => total + suivi.mesures.length,
          0,
        ),
        cutoff,
        dropLegacy,
      },
      null,
      2,
    ),
  );

  if (apply) {
    for (const suivi of replacements) {
      await suivis.replaceOne({ _id: suivi._id }, suivi, { upsert: true });
    }
    for (const user of profiles) {
      const profil = Object.fromEntries(
        [
          ['tailleCm', user.tailleCm],
          ['age', user.age],
          ['sexe', user.sexe],
        ].filter(([, value]) => value !== undefined),
      );
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            profil,
          },
          $unset: { tailleCm: '', age: '', sexe: '' },
        },
      );
    }
    if (dropLegacy) {
      for (const collection of [plans, measurements]) {
        try {
          await collection.drop();
        } catch (error) {
          if (error?.codeName !== 'NamespaceNotFound') throw error;
        }
      }
    }
  }
} finally {
  await mongoose.disconnect();
}
