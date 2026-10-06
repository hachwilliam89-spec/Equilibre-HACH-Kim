import type { Measurement } from "../measurements/api";
import type { FoodCategory, MealCategory, ReferenceFood } from "../nutrition/api";
import {
  emptyServerState,
  type LocalOperation,
  type QueuedOperation,
  type ServerState,
} from "./contracts";
import type { LocalStore } from "./local-store";
import { MAX_RECENTS } from "./projection";

/** Sous-ensemble de l'API expo-sqlite utilisé ici (remplaçable en test). */
export type SqlParam = string | number | null;
export interface SqlExecutor {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlParam[]): Promise<unknown>;
  getAllAsync<T>(source: string, params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SqlParam[]): Promise<T | null>;
}
export interface SqlDatabase extends SqlExecutor {
  withExclusiveTransactionAsync(
    task: (tx: SqlExecutor) => Promise<void>,
  ): Promise<void>;
}

/**
 * Schéma de la base embarquée. Uniquement ce que l'utilisateur voit :
 * plan actif et statut de suivi, mesures (3 mois), journaux d'aujourd'hui
 * et d'hier, aliments favoris ou récents. Le référentiel complet des
 * aliments n'est pas copié.
 */
export const SCHEMA_VERSION = 1;
export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS meta (
  cle TEXT PRIMARY KEY NOT NULL,
  valeur TEXT
);
CREATE TABLE IF NOT EXISTS plan_actif (
  id TEXT PRIMARY KEY NOT NULL,
  poids_depart REAL NOT NULL,
  poids_cible REAL NOT NULL,
  date_debut TEXT NOT NULL,
  date_cible TEXT NOT NULL,
  imc_cible REAL NOT NULL,
  niveau_activite TEXT NOT NULL,
  budget_calorique REAL NOT NULL,
  budget_plafonne_au_bmr INTEGER NOT NULL,
  statut TEXT NOT NULL,
  statut_suivi TEXT NOT NULL,
  derniere_mesure TEXT,
  poids_attendu REAL,
  ecart_kg REAL,
  cible_proteines_g REAL,
  cible_glucides_g REAL,
  cible_lipides_g REAL
);
CREATE TABLE IF NOT EXISTS mesures (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL,
  poids_kg REAL NOT NULL,
  recu_le TEXT NOT NULL,
  jour_utc TEXT NOT NULL,
  source TEXT NOT NULL,
  statut TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journaux (
  plan_id TEXT NOT NULL,
  jour_utc TEXT NOT NULL,
  budget_calorique REAL NOT NULL,
  PRIMARY KEY (plan_id, jour_utc)
);
CREATE TABLE IF NOT EXISTS entrees_alimentaires (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL,
  jour_utc TEXT NOT NULL,
  food_id TEXT NOT NULL,
  nom TEXT NOT NULL,
  quantite_g REAL NOT NULL,
  calories_kcal REAL NOT NULL,
  proteines_g REAL NOT NULL,
  glucides_g REAL NOT NULL,
  lipides_g REAL NOT NULL,
  categorie_repas TEXT NOT NULL,
  recu_le TEXT NOT NULL,
  FOREIGN KEY (plan_id, jour_utc) REFERENCES journaux (plan_id, jour_utc) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_entrees_journal ON entrees_alimentaires (plan_id, jour_utc);
CREATE TABLE IF NOT EXISTS aliments (
  id TEXT PRIMARY KEY NOT NULL,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL,
  calories_kcal_100g REAL NOT NULL,
  proteines_g_100g REAL NOT NULL,
  glucides_g_100g REAL NOT NULL,
  lipides_g_100g REAL NOT NULL,
  favori INTEGER NOT NULL DEFAULT 0,
  utilise_le TEXT
);
CREATE TABLE IF NOT EXISTS operations_en_attente (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  charge TEXT NOT NULL,
  cree_le TEXT NOT NULL,
  tentatives INTEGER NOT NULL DEFAULT 0
);
`;

const TABLES_SERVEUR = ["entrees_alimentaires", "journaux", "mesures", "plan_actif"];

type PlanRow = {
  id: string;
  poids_depart: number;
  poids_cible: number;
  date_debut: string;
  date_cible: string;
  imc_cible: number;
  niveau_activite: string;
  budget_calorique: number;
  budget_plafonne_au_bmr: number;
  statut: string;
  statut_suivi: string;
  derniere_mesure: string | null;
  poids_attendu: number | null;
  ecart_kg: number | null;
  cible_proteines_g: number | null;
  cible_glucides_g: number | null;
  cible_lipides_g: number | null;
};
type MesureRow = {
  id: string;
  plan_id: string;
  poids_kg: number;
  recu_le: string;
  jour_utc: string;
  source: string;
  statut: string;
};
type JournalRow = { plan_id: string; jour_utc: string; budget_calorique: number };
type EntreeRow = {
  id: string;
  plan_id: string;
  jour_utc: string;
  food_id: string;
  nom: string;
  quantite_g: number;
  calories_kcal: number;
  proteines_g: number;
  glucides_g: number;
  lipides_g: number;
  categorie_repas: string;
  recu_le: string;
};
type AlimentRow = {
  id: string;
  nom: string;
  categorie: string;
  calories_kcal_100g: number;
  proteines_g_100g: number;
  glucides_g_100g: number;
  lipides_g_100g: number;
  favori: number;
  utilise_le: string | null;
};
type OperationRow = {
  id: string;
  type: string;
  charge: string;
  cree_le: string;
  tentatives: number;
};

const toFood = (row: AlimentRow): ReferenceFood => ({
  id: row.id,
  nom: row.nom,
  categorie: row.categorie as FoodCategory,
  caloriesKcalPour100g: row.calories_kcal_100g,
  proteinesGPour100g: row.proteines_g_100g,
  glucidesGPour100g: row.glucides_g_100g,
  lipidesGPour100g: row.lipides_g_100g,
});

const upsertAliment = (
  tx: SqlExecutor,
  food: ReferenceFood,
  favori: number | null,
  utiliseLe: string | null,
) =>
  tx.runAsync(
    `INSERT INTO aliments (id, nom, categorie, calories_kcal_100g, proteines_g_100g,
       glucides_g_100g, lipides_g_100g, favori, utilise_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), ?)
     ON CONFLICT (id) DO UPDATE SET
       nom = excluded.nom, categorie = excluded.categorie,
       calories_kcal_100g = excluded.calories_kcal_100g,
       proteines_g_100g = excluded.proteines_g_100g,
       glucides_g_100g = excluded.glucides_g_100g,
       lipides_g_100g = excluded.lipides_g_100g,
       favori = COALESCE(?, aliments.favori),
       utilise_le = COALESCE(excluded.utilise_le, aliments.utilise_le)`,
    [
      food.id,
      food.nom,
      food.categorie,
      food.caloriesKcalPour100g,
      food.proteinesGPour100g,
      food.glucidesGPour100g,
      food.lipidesGPour100g,
      favori,
      utiliseLe,
      favori,
    ],
  );

const setMeta = (tx: SqlExecutor, cle: string, valeur: string | null) =>
  tx.runAsync(
    "INSERT INTO meta (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur",
    [cle, valeur],
  );

export function createSqliteStore(db: SqlDatabase): LocalStore {
  const getMeta = async (cle: string) =>
    (await db.getFirstAsync<{ valeur: string | null }>(
      "SELECT valeur FROM meta WHERE cle = ?",
      [cle],
    ))?.valeur ?? null;

  const migrer = async () => {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    const row = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
      [],
    );
    if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.execAsync(SCHEMA_V1);
        await tx.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      });
    }
  };

  const viderTout = (tx: SqlExecutor) =>
    tx.execAsync(
      [...TABLES_SERVEUR, "aliments", "operations_en_attente", "meta"]
        .map((table) => `DELETE FROM ${table};`)
        .join("\n"),
    );

  return {
    async ouvrir(userId) {
      await migrer();
      if ((await getMeta("user_id")) !== userId) {
        await db.withExclusiveTransactionAsync(async (tx) => {
          await viderTout(tx);
          await setMeta(tx, "user_id", userId);
        });
      }
    },

    async lireEtatServeur() {
      const etat = emptyServerState();
      etat.curseur = await getMeta("curseur");
      etat.synchroniseLe = await getMeta("synchronise_le");
      const plan = await db.getFirstAsync<PlanRow>("SELECT * FROM plan_actif LIMIT 1", []);
      if (plan) {
        etat.suiviPoids = {
          statut: plan.statut_suivi as NonNullable<ServerState["suiviPoids"]>["statut"],
          plan: {
            id: plan.id,
            poidsDepart: plan.poids_depart,
            poidsCible: plan.poids_cible,
            dateDebut: plan.date_debut,
            dateCible: plan.date_cible,
            imcCible: plan.imc_cible,
            niveauActivite: plan.niveau_activite as "sedentaire",
            budgetCalorique: plan.budget_calorique,
            budgetPlafonneAuBmr: plan.budget_plafonne_au_bmr === 1,
            statut: plan.statut as "actif",
          },
          derniereMesure: plan.derniere_mesure
            ? (JSON.parse(plan.derniere_mesure) as Measurement)
            : null,
          poidsAttendu: plan.poids_attendu,
          ecartKg: plan.ecart_kg,
        };
        const journaux = await db.getAllAsync<JournalRow>(
          "SELECT * FROM journaux WHERE plan_id = ? ORDER BY jour_utc DESC",
          [plan.id],
        );
        const entrees = await db.getAllAsync<EntreeRow>(
          "SELECT * FROM entrees_alimentaires WHERE plan_id = ? ORDER BY recu_le ASC",
          [plan.id],
        );
        etat.alimentation = {
          planId: plan.id,
          budgetCalorique: plan.budget_calorique,
          ciblesMacros: {
            proteinesG: plan.cible_proteines_g ?? 0,
            glucidesG: plan.cible_glucides_g ?? 0,
            lipidesG: plan.cible_lipides_g ?? 0,
          },
          journaux: journaux.map((journal) => {
            const lignes = entrees
              .filter((entry) => entry.jour_utc === journal.jour_utc)
              .map((entry) => ({
                id: entry.id,
                foodId: entry.food_id,
                nom: entry.nom,
                quantiteGrammes: entry.quantite_g,
                caloriesKcal: entry.calories_kcal,
                proteinesG: entry.proteines_g,
                glucidesG: entry.glucides_g,
                lipidesG: entry.lipides_g,
                categorieRepas: entry.categorie_repas as MealCategory,
                receivedAt: entry.recu_le,
              }));
            const total = (champ: "caloriesKcal" | "proteinesG" | "glucidesG" | "lipidesG") =>
              lignes.reduce((sum, entry) => sum + entry[champ], 0);
            return {
              planId: journal.plan_id,
              jourUtc: journal.jour_utc,
              budgetCalorique: journal.budget_calorique,
              entrees: lignes,
              totalCaloriesKcal: total("caloriesKcal"),
              totalProteinesG: total("proteinesG"),
              totalGlucidesG: total("glucidesG"),
              totalLipidesG: total("lipidesG"),
            };
          }),
        };
      }
      etat.mesures = (
        await db.getAllAsync<MesureRow>("SELECT * FROM mesures ORDER BY recu_le DESC", [])
      ).map((row) => ({
        id: row.id,
        userId: "",
        planId: row.plan_id,
        poidsKg: row.poids_kg,
        receivedAt: row.recu_le,
        jourUtc: row.jour_utc,
        source: row.source as Measurement["source"],
        statut: row.statut as Measurement["statut"],
      }));
      const aliments = await db.getAllAsync<AlimentRow>("SELECT * FROM aliments", []);
      etat.favoris = aliments
        .filter((row) => row.favori === 1)
        .map(toFood)
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      etat.recents = aliments
        .filter((row): row is AlimentRow & { utilise_le: string } => row.utilise_le !== null)
        .map((row) => ({ ...toFood(row), utiliseLe: row.utilise_le }));
      return etat;
    },

    async remplacerEtatServeur(snapshot, recuLe) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.execAsync(TABLES_SERVEUR.map((t) => `DELETE FROM ${t};`).join("\n"));
        const suivi = snapshot.suiviPoids;
        if (suivi) {
          const cibles = snapshot.alimentation?.ciblesMacros;
          await tx.runAsync(
            `INSERT INTO plan_actif VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              suivi.plan.id,
              suivi.plan.poidsDepart,
              suivi.plan.poidsCible,
              suivi.plan.dateDebut,
              suivi.plan.dateCible,
              suivi.plan.imcCible,
              suivi.plan.niveauActivite,
              snapshot.alimentation?.budgetCalorique ?? suivi.plan.budgetCalorique,
              suivi.plan.budgetPlafonneAuBmr ? 1 : 0,
              suivi.plan.statut,
              suivi.statut,
              suivi.derniereMesure ? JSON.stringify(suivi.derniereMesure) : null,
              suivi.poidsAttendu,
              suivi.ecartKg,
              cibles?.proteinesG ?? null,
              cibles?.glucidesG ?? null,
              cibles?.lipidesG ?? null,
            ],
          );
        }
        for (const m of snapshot.mesures) {
          await tx.runAsync("INSERT INTO mesures VALUES (?, ?, ?, ?, ?, ?, ?)", [
            m.id,
            m.planId,
            m.poidsKg,
            m.receivedAt,
            m.jourUtc,
            m.source,
            m.statut,
          ]);
        }
        for (const journal of snapshot.alimentation?.journaux ?? []) {
          await tx.runAsync("INSERT INTO journaux VALUES (?, ?, ?)", [
            journal.planId,
            journal.jourUtc,
            journal.budgetCalorique,
          ]);
          for (const e of journal.entrees) {
            await tx.runAsync(
              "INSERT INTO entrees_alimentaires VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                e.id,
                journal.planId,
                journal.jourUtc,
                e.foodId,
                e.nom,
                e.quantiteGrammes,
                e.caloriesKcal,
                e.proteinesG,
                e.glucidesG,
                e.lipidesG,
                e.categorieRepas,
                e.receivedAt,
              ],
            );
          }
        }
        await tx.runAsync("UPDATE aliments SET favori = 0", []);
        for (const food of snapshot.favoris) await upsertAliment(tx, food, 1, null);
        await tx.runAsync("DELETE FROM aliments WHERE favori = 0 AND utilise_le IS NULL", []);
        await setMeta(tx, "curseur", snapshot.curseur);
        await setMeta(tx, "synchronise_le", recuLe);
      });
    },

    async marquerSynchronise(le) {
      await setMeta(db, "synchronise_le", le);
    },

    async operations() {
      const rows = await db.getAllAsync<OperationRow>(
        "SELECT * FROM operations_en_attente ORDER BY cree_le ASC, rowid ASC",
        [],
      );
      return rows.map((row) => ({
        ...(JSON.parse(row.charge) as LocalOperation),
        creeLe: row.cree_le,
        tentatives: row.tentatives,
      })) as QueuedOperation[];
    },

    async enfiler(operation, creeLe) {
      await db.runAsync(
        "INSERT INTO operations_en_attente (id, type, charge, cree_le) VALUES (?, ?, ?, ?)",
        [operation.id, operation.type, JSON.stringify(operation), creeLe],
      );
    },

    async retirerOperations(ids) {
      if (ids.length === 0) return;
      await db.runAsync(
        `DELETE FROM operations_en_attente WHERE id IN (${ids.map(() => "?").join(", ")})`,
        ids,
      );
    },

    async noterTentative(ids) {
      if (ids.length === 0) return;
      await db.runAsync(
        `UPDATE operations_en_attente SET tentatives = tentatives + 1 WHERE id IN (${ids
          .map(() => "?")
          .join(", ")})`,
        ids,
      );
    },

    async noterRecent(food, le) {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await upsertAliment(tx, food, null, le);
        // Ne garder que les derniers aliments utilisés (hors favoris).
        await tx.runAsync(
          `UPDATE aliments SET utilise_le = NULL WHERE utilise_le IS NOT NULL AND id NOT IN (
             SELECT id FROM aliments WHERE utilise_le IS NOT NULL ORDER BY utilise_le DESC LIMIT ?)`,
          [MAX_RECENTS],
        );
        await tx.runAsync("DELETE FROM aliments WHERE favori = 0 AND utilise_le IS NULL", []);
      });
    },

    async vider() {
      await migrer();
      await db.withExclusiveTransactionAsync(async (tx) => viderTout(tx));
    },
  };
}
