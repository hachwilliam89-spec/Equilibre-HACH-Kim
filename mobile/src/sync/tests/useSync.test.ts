import type { SyncApi } from "../api";
import type { LocalOperation } from "../contracts";
import { createMemoryStore } from "../memory-store";
import { configurerSynchro, useSync } from "../useSync";
import { pomme, riz, snapshot } from "./fixtures";

jest.mock("../database", () => ({ getLocalStore: jest.fn() }));

const reseauCoupe = new Error("Connexion interrompue");

function preparer(options: { enLigne: boolean }) {
  const store = createMemoryStore();
  const envois: LocalOperation[][] = [];
  let enLigne = options.enLigne;
  const api: SyncApi = {
    async pull() {
      if (!enLigne) throw reseauCoupe;
      return snapshot();
    },
    async push(operations) {
      if (!enLigne) throw reseauCoupe;
      envois.push(operations);
      return {
        resultats: operations.map((op) => ({ id: op.id, statut: "appliquee" as const })),
        instantane: snapshot({ curseur: "apres-push" }),
      };
    },
  };
  let compteur = 0;
  configurerSynchro({
    store: async () => store,
    api,
    uuid: () => `00000000-0000-4000-8000-${String(++compteur).padStart(12, "0")}`,
    maintenant: () => new Date("2026-10-06T12:00:00.000Z"),
  });
  return {
    store,
    envois,
    retablir: () => (enLigne = true),
    couper: () => (enLigne = false),
  };
}

afterEach(async () => {
  await useSync.getState().reinitialiser();
});

describe("useSync", () => {
  it("au démarrage en ligne : récupère l'instantané et l'affiche", async () => {
    preparer({ enLigne: true });
    await useSync.getState().demarrer("u-1");
    await useSync.getState().synchroniser();

    const { vue, horsLigne } = useSync.getState();
    expect(horsLigne).toBe(false);
    expect(vue.synchroniseLe).toBe("2026-10-06T12:00:00.000Z");
    expect(vue.suiviPoids?.statut).toBe("dans-les-clous");
  });

  it("hors ligne : l'ajout est visible tout de suite puis envoyé au retour du réseau", async () => {
    const { envois, retablir } = preparer({ enLigne: false });
    await useSync.getState().demarrer("u-1");

    await useSync.getState().ajouterAliment(pomme, 150, "collation");
    await useSync.getState().synchroniser();

    expect(useSync.getState().horsLigne).toBe(true);
    expect(useSync.getState().vue.operationsEnAttente).toBe(1);
    expect(useSync.getState().vue.recents).toEqual([pomme]);

    retablir();
    await useSync.getState().synchroniser();

    expect(envois.flat().map((op) => op.type)).toEqual(["ajout-aliment"]);
    expect(useSync.getState().vue.operationsEnAttente).toBe(0);
    expect(useSync.getState().horsLigne).toBe(false);
  });

  it("retirer un aliment ajouté hors ligne annule l'ajout au lieu d'envoyer deux opérations", async () => {
    const { store, envois, retablir, couper } = preparer({ enLigne: true });
    await useSync.getState().demarrer("u-1");
    await useSync.getState().synchroniser();
    couper();

    await useSync.getState().ajouterAliment(riz, 100, "diner");
    await useSync.getState().synchroniser();
    const entree = useSync
      .getState()
      .vue.alimentation?.journaux.flatMap((journal) => journal.entrees)
      .find((entry) => entry.enAttente);
    expect(entree).toMatchObject({ nom: riz.nom, caloriesKcal: 130 });

    await useSync.getState().retirerEntree(entree!);

    expect(await store.operations()).toEqual([]);
    expect(
      useSync.getState().vue.alimentation?.journaux.flatMap((j) => j.entrees).some((e) => e.enAttente),
    ).toBe(false);
    retablir();
    await useSync.getState().synchroniser();
    expect(envois).toEqual([]);
  });

  it("retirer une entrée déjà synchronisée envoie un retrait", async () => {
    const { envois } = preparer({ enLigne: true });
    await useSync.getState().demarrer("u-1");
    await useSync.getState().synchroniser();
    const entree = useSync.getState().vue.alimentation!.journaux[0].entrees[0];

    await useSync.getState().retirerEntree(entree);
    await useSync.getState().synchroniser();

    expect(envois.flat()).toEqual([
      expect.objectContaining({ type: "retrait-aliment", entreeId: "e-1" }),
    ]);
  });

  it("ne garde que le dernier choix de favori non envoyé", async () => {
    const { store, envois, retablir } = preparer({ enLigne: false });
    await useSync.getState().demarrer("u-1");
    await useSync.getState().basculerFavori(pomme, true);
    await useSync.getState().synchroniser();
    await useSync.getState().basculerFavori(pomme, false);
    await useSync.getState().synchroniser();

    expect((await store.operations()).map((op) => op.type === "favori" && op.favori)).toEqual([false]);
    retablir();
    await useSync.getState().synchroniser();
    expect(envois.flat()).toHaveLength(1);
  });

  it("la déconnexion efface la base embarquée", async () => {
    const { store } = preparer({ enLigne: false });
    await useSync.getState().demarrer("u-1");
    await useSync.getState().saisirPoids(79.2);
    await useSync.getState().reinitialiser();

    expect(await store.operations()).toEqual([]);
    expect(useSync.getState().userId).toBeNull();
  });
});
