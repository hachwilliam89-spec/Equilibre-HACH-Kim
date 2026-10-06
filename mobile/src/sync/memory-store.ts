import type { ReferenceFood } from "../nutrition/api";
import {
  emptyServerState,
  type LocalOperation,
  type QueuedOperation,
  type ServerState,
  type Snapshot,
} from "./contracts";
import type { LocalStore } from "./local-store";
import { MAX_RECENTS } from "./projection";

/** Adaptateur sans persistance : aperçu web et tests. */
export function createMemoryStore(): LocalStore {
  let userId: string | null = null;
  let serveur: ServerState = emptyServerState();
  let file: QueuedOperation[] = [];
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  return {
    async ouvrir(id) {
      if (userId !== id) {
        serveur = emptyServerState();
        file = [];
      }
      userId = id;
    },
    async lireEtatServeur() {
      return clone(serveur);
    },
    async remplacerEtatServeur(snapshot: Snapshot, recuLe) {
      serveur = {
        ...clone(snapshot),
        synchroniseLe: recuLe,
        recents: serveur.recents,
      };
    },
    async marquerSynchronise(le) {
      serveur = { ...serveur, synchroniseLe: le };
    },
    async operations() {
      return clone(file);
    },
    async enfiler(operation: LocalOperation, creeLe) {
      file = [...file, { ...clone(operation), creeLe, tentatives: 0 }];
    },
    async retirerOperations(ids) {
      const set = new Set(ids);
      file = file.filter((op) => !set.has(op.id));
    },
    async noterTentative(ids) {
      const set = new Set(ids);
      file = file.map((op) =>
        set.has(op.id) ? { ...op, tentatives: op.tentatives + 1 } : op,
      );
    },
    async noterRecent(food: ReferenceFood, le) {
      serveur = {
        ...serveur,
        recents: [
          { ...clone(food), utiliseLe: le },
          ...serveur.recents.filter((item) => item.id !== food.id),
        ].slice(0, MAX_RECENTS),
      };
    },
    async vider() {
      userId = null;
      serveur = emptyServerState();
      file = [];
    },
  };
}
