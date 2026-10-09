import { randomUUID } from "expo-crypto";
import { create } from "zustand";
import { ApiError } from "../auth/api";
import type { FoodEntry, MealCategory, ReferenceFood } from "../nutrition/api";
import { referenceFoodFromEntry } from "../nutrition/presentation";
import { httpSyncApi, type SyncApi } from "./api";
import { emptyServerState, type LocalOperation, type LocalView } from "./contracts";
import { getLocalStore } from "./database";
import { synchroniser, type Rejet } from "./engine";
import type { LocalStore } from "./local-store";
import { projeter } from "./projection";

type Dependances = {
  store: () => Promise<LocalStore>;
  api: SyncApi;
  uuid: () => string;
  maintenant: () => Date;
};

let deps: Dependances = {
  store: getLocalStore,
  api: httpSyncApi,
  uuid: randomUUID,
  maintenant: () => new Date(),
};

/** Tests uniquement : remplace la base, l'API ou l'horloge. */
export function configurerSynchro(overrides: Partial<Dependances>) {
  deps = { ...deps, ...overrides };
}

type State = {
  userId: string | null;
  vue: LocalView;
  enCours: boolean;
  /** Dernière tentative échouée faute de réseau. */
  horsLigne: boolean;
  erreur: string | null;
  rejets: Rejet[];
  demarrer: (userId: string) => Promise<void>;
  synchroniser: () => Promise<void>;
  ajouterAliment: (
    food: ReferenceFood,
    quantiteGrammes: number,
    categorieRepas?: Exclude<MealCategory, "non-classe">,
  ) => Promise<void>;
  retirerEntree: (entry: FoodEntry) => Promise<void>;
  /**
   * Nouvelle quantité ou nouveau repas pour une entrée : retrait puis ajout,
   * sans nouvelle règle côté serveur (seuls ajout et retrait existent).
   */
  modifierEntree: (
    entry: FoodEntry,
    quantiteGrammes: number,
    categorieRepas?: Exclude<MealCategory, "non-classe">,
  ) => Promise<void>;
  saisirPoids: (poidsKg: number) => Promise<void>;
  basculerFavori: (food: ReferenceFood, favori: boolean) => Promise<void>;
  noterRecent: (food: ReferenceFood) => Promise<void>;
  effacerRejets: () => void;
  /** Déconnexion : efface la base embarquée. */
  reinitialiser: () => Promise<void>;
};

const vueVide = (): LocalView => projeter(emptyServerState(), [], new Date(), false);

let cycle: Promise<void> | null = null;
let relancer = false;

export const useSync = create<State>((set, get) => {
  const rafraichir = async () => {
    const store = await deps.store();
    const [serveur, file] = await Promise.all([store.lireEtatServeur(), store.operations()]);
    set({ vue: projeter(serveur, file, deps.maintenant()) });
  };

  const enfiler = async (operation: LocalOperation) => {
    const store = await deps.store();
    await store.enfiler(operation, deps.maintenant().toISOString());
    await rafraichir();
    void get().synchroniser();
  };

  /**
   * Annule localement une opération pas encore envoyée plutôt que d'en
   * empiler une seconde (ex. retrait d'un aliment ajouté hors ligne). Jamais
   * pendant un cycle : l'opération est peut-être déjà en route.
   */
  const annulerSiEnAttente = async (predicat: (op: LocalOperation) => boolean) => {
    if (cycle) return false;
    const store = await deps.store();
    const cible = (await store.operations()).filter(predicat);
    if (cible.length === 0) return false;
    await store.retirerOperations(cible.map((op) => op.id));
    return true;
  };

  return {
    userId: null,
    vue: vueVide(),
    enCours: false,
    horsLigne: false,
    erreur: null,
    rejets: [],

    demarrer: async (userId) => {
      if (get().userId === userId) {
        void get().synchroniser();
        return;
      }
      try {
        const store = await deps.store();
        await store.ouvrir(userId);
        set({ userId, rejets: [], erreur: null });
        await rafraichir();
      } catch {
        set({ erreur: "Base locale indisponible sur cet appareil." });
        return;
      }
      void get().synchroniser();
    },

    synchroniser: async () => {
      if (!get().userId) return;
      if (cycle) {
        // Une modification arrivée pendant le cycle partira juste après.
        relancer = true;
        return cycle;
      }
      cycle = (async () => {
        set({ enCours: true });
        try {
          do {
            relancer = false;
            const rapport = await synchroniser(await deps.store(), deps.api, deps.maintenant);
            set((state) => ({
              horsLigne: false,
              erreur: null,
              rejets: [...state.rejets, ...rapport.rejets],
            }));
            await rafraichir();
          } while (relancer);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            set({ erreur: "Session expirée. Reconnecte-toi pour synchroniser." });
          } else if (error instanceof ApiError) {
            set({ erreur: error.message });
          } else {
            set({ horsLigne: true });
          }
        } finally {
          cycle = null;
          set({ enCours: false });
        }
      })();
      return cycle;
    },

    ajouterAliment: async (food, quantiteGrammes, categorieRepas) => {
      await enfiler({
        id: deps.uuid(),
        type: "ajout-aliment",
        entreeId: deps.uuid(),
        foodId: food.id,
        quantiteGrammes,
        ...(categorieRepas ? { categorieRepas } : {}),
        consommeLe: deps.maintenant().toISOString(),
        aliment: food,
      });
      await get().noterRecent(food);
    },

    retirerEntree: async (entry) => {
      const annulee = await annulerSiEnAttente(
        (op) => op.type === "ajout-aliment" && op.entreeId === entry.id,
      );
      if (annulee) {
        await rafraichir();
        return;
      }
      await enfiler({ id: deps.uuid(), type: "retrait-aliment", entreeId: entry.id });
    },

    modifierEntree: async (entry, quantiteGrammes, categorieRepas) => {
      await get().retirerEntree(entry);
      await get().ajouterAliment(referenceFoodFromEntry(entry), quantiteGrammes, categorieRepas);
    },

    saisirPoids: async (poidsKg) => {
      await enfiler({
        id: deps.uuid(),
        type: "saisie-poids",
        mesureId: deps.uuid(),
        poidsKg,
        saisiLe: deps.maintenant().toISOString(),
      });
    },

    basculerFavori: async (food, favori) => {
      // Seul le dernier choix compte : on remplace un basculement non envoyé.
      await annulerSiEnAttente((op) => op.type === "favori" && op.foodId === food.id);
      await enfiler({ id: deps.uuid(), type: "favori", foodId: food.id, favori, aliment: food });
    },

    noterRecent: async (food) => {
      const store = await deps.store();
      await store.noterRecent(food, deps.maintenant().toISOString());
      await rafraichir();
    },

    effacerRejets: () => set({ rejets: [] }),

    reinitialiser: async () => {
      if (cycle) await cycle.catch(() => undefined);
      try {
        await (await deps.store()).vider();
      } catch {
        // Base indisponible : rien à effacer de plus que l'état en mémoire.
      }
      set({ userId: null, vue: vueVide(), rejets: [], erreur: null, horsLigne: false });
    },
  };
});
