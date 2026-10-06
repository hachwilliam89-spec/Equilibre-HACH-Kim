import { z } from "zod";
import {
  measurementSchema,
  weightTrackingSchema,
  type Measurement,
  type WeightTracking,
} from "../measurements/api";
import {
  foodJournalSchema,
  macroTargetsSchema,
  referenceFoodSchema,
  type FoodEntry,
  type MacroTargets,
  type MealCategory,
  type ReferenceFood,
} from "../nutrition/api";

// ---------- Instantané envoyé par le serveur (pull) ----------

export const snapshotSchema = z.object({
  curseur: z.string().min(1),
  genereLe: z.string(),
  suiviPoids: weightTrackingSchema,
  mesures: z.array(measurementSchema),
  alimentation: z
    .object({
      planId: z.string(),
      budgetCalorique: z.number(),
      ciblesMacros: macroTargetsSchema,
      journaux: z.array(foodJournalSchema),
    })
    .nullable(),
  favoris: z.array(referenceFoodSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const operationResultSchema = z.object({
  id: z.string(),
  statut: z.enum(["appliquee", "deja-appliquee", "rejetee", "a-reessayer"]),
  code: z.string().optional(),
  message: z.string().optional(),
});
export type OperationResult = z.infer<typeof operationResultSchema>;

export const pushResultSchema = z.object({
  resultats: z.array(operationResultSchema),
  instantane: snapshotSchema,
});

// ---------- Opérations en file d'attente (push) ----------

/**
 * Une modification faite sur l'appareil. Les identifiants (opération, entrée,
 * mesure) sont générés localement : le serveur s'en sert pour rendre le rejeu
 * idempotent. `aliment` ne quitte jamais l'appareil : il sert uniquement à
 * afficher l'entrée en attente avec ses valeurs nutritionnelles.
 */
export type LocalOperation =
  | {
      id: string;
      type: "ajout-aliment";
      entreeId: string;
      foodId: string;
      quantiteGrammes: number;
      categorieRepas?: Exclude<MealCategory, "non-classe">;
      consommeLe: string;
      aliment: ReferenceFood;
    }
  | { id: string; type: "retrait-aliment"; entreeId: string }
  | {
      id: string;
      type: "saisie-poids";
      mesureId: string;
      poidsKg: number;
      saisiLe: string;
    }
  | {
      id: string;
      type: "favori";
      foodId: string;
      favori: boolean;
      aliment: ReferenceFood;
    };

export type QueuedOperation = LocalOperation & {
  creeLe: string;
  tentatives: number;
};

/** Ce qui part réellement sur le réseau : le strict nécessaire. */
export function toWire(operation: LocalOperation) {
  switch (operation.type) {
    case "ajout-aliment": {
      const { aliment: _aliment, ...wire } = operation;
      return wire;
    }
    case "favori":
      return {
        id: operation.id,
        type: operation.type,
        foodId: operation.foodId,
        favori: operation.favori,
      };
    case "retrait-aliment":
      return {
        id: operation.id,
        type: operation.type,
        entreeId: operation.entreeId,
      };
    case "saisie-poids":
      return {
        id: operation.id,
        type: operation.type,
        mesureId: operation.mesureId,
        poidsKg: operation.poidsKg,
        saisiLe: operation.saisiLe,
      };
  }
}

// ---------- État serveur conservé sur l'appareil ----------

/** Copie locale du dernier instantané accepté + aliments récents. */
export type ServerState = {
  curseur: string | null;
  synchroniseLe: string | null;
  suiviPoids: WeightTracking;
  mesures: Measurement[];
  alimentation: Snapshot["alimentation"];
  favoris: ReferenceFood[];
  recents: (ReferenceFood & { utiliseLe: string })[];
};

export const emptyServerState = (): ServerState => ({
  curseur: null,
  synchroniseLe: null,
  suiviPoids: null,
  mesures: [],
  alimentation: null,
  favoris: [],
  recents: [],
});

// ---------- Vue consommée par les écrans ----------

export type LocalMeasurement = Measurement & { enAttente: boolean };
export type LocalFoodEntry = FoodEntry & { enAttente: boolean };
export type LocalJournal = {
  planId: string;
  jourUtc: string;
  budgetCalorique: number;
  entrees: LocalFoodEntry[];
  totalCaloriesKcal: number;
  totalProteinesG: number;
  totalGlucidesG: number;
  totalLipidesG: number;
};

export type FoodBudgetState = {
  statut: "dans-le-budget" | "depassement" | "pas-de-donnees-recentes";
  ecartKcal: number | null;
  /** Dernier journal non vide d'aujourd'hui ou d'hier, sinon null. */
  journal: LocalJournal | null;
};

export type LocalView = {
  initialise: boolean;
  synchroniseLe: string | null;
  suiviPoids: WeightTracking;
  mesures: LocalMeasurement[];
  alimentation: {
    planId: string;
    budgetCalorique: number;
    ciblesMacros: MacroTargets;
    journaux: LocalJournal[];
    statut: FoodBudgetState;
  } | null;
  favoris: ReferenceFood[];
  recents: ReferenceFood[];
  operationsEnAttente: number;
};

