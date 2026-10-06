import type { LocalStore } from "./local-store";
import { createMemoryStore } from "./memory-store";

// Aperçu web uniquement : aucune donnée personnelle persistée dans le
// navigateur, comme pour la session (voir auth/storage.web.ts).
const store = createMemoryStore();

export function getLocalStore(): Promise<LocalStore> {
  return Promise.resolve(store);
}
