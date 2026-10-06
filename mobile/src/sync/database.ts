import * as SQLite from "expo-sqlite";
import type { LocalStore } from "./local-store";
import { createSqliteStore } from "./sqlite-store";

const NOM_BASE = "equilibre.db";
let store: Promise<LocalStore> | null = null;

/** Base embarquée de l'appareil (une seule connexion pour toute l'app). */
export function getLocalStore(): Promise<LocalStore> {
  if (!store) {
    store = SQLite.openDatabaseAsync(NOM_BASE)
      .then((db) => createSqliteStore(db))
      .catch((error: unknown) => {
        store = null;
        throw error;
      });
  }
  return store;
}
