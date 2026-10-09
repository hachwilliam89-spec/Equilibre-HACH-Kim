import type { SyncApi } from "../api";
import { toWire, type LocalOperation, type OperationResult, type Snapshot } from "../contracts";
import { MAX_TENTATIVES, synchroniser, TAILLE_LOT } from "../engine";
import { createMemoryStore } from "../memory-store";
import { pomme, snapshot } from "./fixtures";

const horloge = () => new Date("2026-10-06T12:00:00.000Z");
const retrait = (id: string): LocalOperation => ({ id, type: "retrait-aliment", entreeId: `e-${id}` });

function fakeApi(options: {
  resultat?: (op: LocalOperation) => OperationResult;
  pull?: () => Snapshot | null;
  erreur?: Error;
}) {
  const appels = { push: [] as LocalOperation[][], pull: [] as (string | null)[] };
  const api: SyncApi = {
    async pull(curseur) {
      appels.pull.push(curseur);
      if (options.erreur) throw options.erreur;
      return options.pull ? options.pull() : snapshot();
    },
    async push(operations) {
      appels.push.push(operations);
      if (options.erreur) throw options.erreur;
      return {
        resultats: operations.map(
          (op) => options.resultat?.(op) ?? { id: op.id, statut: "appliquee" },
        ),
        instantane: snapshot({ curseur: `apres-${appels.push.length}` }),
      };
    },
  };
  return { api, appels };
}

async function storeAvec(...operations: LocalOperation[]) {
  const store = createMemoryStore();
  await store.ouvrir("u-1");
  for (const op of operations) await store.enfiler(op, "2026-10-06T11:00:00.000Z");
  return store;
}

describe("synchroniser", () => {
  it("sans rien à envoyer : pull avec le dernier curseur et enregistre l'instantané", async () => {
    const store = await storeAvec();
    const { api, appels } = fakeApi({});

    const rapport = await synchroniser(store, api, horloge);

    expect(appels.push).toHaveLength(0);
    expect(appels.pull).toEqual([null]);
    expect(rapport.donneesRecues).toBe(true);
    expect((await store.lireEtatServeur()).curseur).toBe("curseur-1");
  });

  it("204 : ne réécrit rien mais date la synchronisation", async () => {
    const store = await storeAvec();
    await store.remplacerEtatServeur(snapshot(), "2026-10-06T08:00:00.000Z");
    const { api, appels } = fakeApi({ pull: () => null });

    const rapport = await synchroniser(store, api, horloge);

    expect(appels.pull).toEqual(["curseur-1"]);
    expect(rapport.donneesRecues).toBe(false);
    expect((await store.lireEtatServeur()).synchroniseLe).toBe("2026-10-06T12:00:00.000Z");
  });

  it("push : vide la file et utilise l'instantané renvoyé, sans pull supplémentaire", async () => {
    const store = await storeAvec(retrait("op-1"), retrait("op-2"));
    const { api, appels } = fakeApi({});

    const rapport = await synchroniser(store, api, horloge);

    expect(appels.push.map((lot) => lot.map((op) => op.id))).toEqual([["op-1", "op-2"]]);
    expect(appels.pull).toHaveLength(0);
    expect(rapport.envoyees).toBe(2);
    expect(await store.operations()).toEqual([]);
    expect((await store.lireEtatServeur()).curseur).toBe("apres-1");
  });

  it("retire et signale une opération refusée par le serveur", async () => {
    const store = await storeAvec(
      { id: "op-1", type: "saisie-poids", mesureId: "m-1", poidsKg: 79, saisiLe: "2026-10-05T07:00:00.000Z" },
      retrait("op-2"),
    );
    const { api } = fakeApi({
      resultat: (op) =>
        op.id === "op-1"
          ? { id: op.id, statut: "rejetee", code: "saisie-poids-expiree", message: "Expirée" }
          : { id: op.id, statut: "appliquee" },
    });

    const rapport = await synchroniser(store, api, horloge);

    expect(rapport.rejets).toEqual([
      expect.objectContaining({ code: "saisie-poids-expiree", message: "Expirée", operation: expect.objectContaining({ id: "op-1" }) }),
    ]);
    expect(await store.operations()).toEqual([]);
  });

  it("considère un rejeu déjà traité comme un succès", async () => {
    const store = await storeAvec(retrait("op-1"));
    const { api } = fakeApi({ resultat: (op) => ({ id: op.id, statut: "deja-appliquee" }) });

    const rapport = await synchroniser(store, api, horloge);

    expect(rapport).toMatchObject({ envoyees: 1, rejets: [] });
    expect(await store.operations()).toEqual([]);
  });

  it("garde en file une opération à réessayer, puis l'abandonne après plusieurs échecs", async () => {
    const store = await storeAvec(retrait("op-1"));
    const { api } = fakeApi({ resultat: (op) => ({ id: op.id, statut: "a-reessayer" }) });

    for (let i = 1; i < MAX_TENTATIVES; i += 1) {
      await synchroniser(store, api, horloge);
      expect((await store.operations())[0]?.tentatives).toBe(i);
    }
    const rapport = await synchroniser(store, api, horloge);

    expect(rapport.rejets).toHaveLength(1);
    expect(await store.operations()).toEqual([]);
  });

  it("hors ligne : l'erreur remonte et la file reste intacte", async () => {
    const operation: LocalOperation = {
      id: "op-1",
      type: "ajout-aliment",
      entreeId: "e-1",
      foodId: pomme.id,
      quantiteGrammes: 100,
      consommeLe: "2026-10-06T11:00:00.000Z",
      aliment: pomme,
    };
    const store = await storeAvec(operation);
    const { api } = fakeApi({ erreur: new Error("réseau") });

    await expect(synchroniser(store, api, horloge)).rejects.toThrow("réseau");
    expect(await store.operations()).toEqual([
      { ...operation, creeLe: "2026-10-06T11:00:00.000Z", tentatives: 0 },
    ]);
  });

  it(`envoie une longue file par lots de ${TAILLE_LOT}`, async () => {
    const store = await storeAvec(
      ...Array.from({ length: TAILLE_LOT + 5 }, (_, i) => retrait(`op-${i}`)),
    );
    const { api, appels } = fakeApi({});

    const rapport = await synchroniser(store, api, horloge);

    expect(appels.push.map((lot) => lot.length)).toEqual([TAILLE_LOT, 5]);
    expect(rapport.envoyees).toBe(TAILLE_LOT + 5);
  });
});

describe("toWire", () => {
  it("n'envoie jamais les données locales d'affichage", () => {
    expect(
      toWire({
        id: "op-1",
        type: "favori",
        foodId: pomme.id,
        favori: true,
        aliment: pomme,
      }),
    ).toEqual({ id: "op-1", type: "favori", foodId: pomme.id, favori: true });
  });

  it("n'envoie pas les métadonnées de la file d'attente (creeLe, tentatives)", () => {
    const queued = {
      id: "op-2",
      type: "ajout-aliment" as const,
      entreeId: "e-2",
      foodId: pomme.id,
      quantiteGrammes: 150,
      categorieRepas: "collation" as const,
      consommeLe: "2026-10-09T06:00:00.000Z",
      aliment: pomme,
      creeLe: "2026-10-09T06:00:00.000Z",
      tentatives: 2,
    };
    expect(toWire(queued)).toEqual({
      id: "op-2",
      type: "ajout-aliment",
      entreeId: "e-2",
      foodId: pomme.id,
      quantiteGrammes: 150,
      categorieRepas: "collation",
      consommeLe: "2026-10-09T06:00:00.000Z",
    });
    const { categorieRepas: _c, ...sansRepas } = queued;
    expect(toWire(sansRepas)).not.toHaveProperty("categorieRepas");
  });
});
