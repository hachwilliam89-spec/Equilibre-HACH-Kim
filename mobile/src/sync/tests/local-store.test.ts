import type { LocalStore } from "../local-store";
import { createMemoryStore } from "../memory-store";
import { createSqliteStore } from "../sqlite-store";
import { snapshot, pomme, riz } from "./fixtures";
import { createSqlJsDatabase } from "./sqljs-database";

/**
 * Tests de contrat : l'adaptateur SQLite (vrai SQL exécuté par sql.js) et
 * l'adaptateur mémoire (web) doivent se comporter exactement pareil.
 */
const adaptateurs: [string, () => Promise<LocalStore>][] = [
  ["SQLite", async () => createSqliteStore(await createSqlJsDatabase())],
  ["mémoire", async () => createMemoryStore()],
];

describe.each(adaptateurs)("LocalStore %s", (_nom, creer) => {
  let store: LocalStore;
  beforeEach(async () => {
    store = await creer();
    await store.ouvrir("u-1");
  });

  it("démarre vide", async () => {
    const etat = await store.lireEtatServeur();
    expect(etat).toMatchObject({
      curseur: null,
      synchroniseLe: null,
      suiviPoids: null,
      mesures: [],
      alimentation: null,
      favoris: [],
      recents: [],
    });
    expect(await store.operations()).toEqual([]);
  });

  it("conserve fidèlement l'instantané serveur", async () => {
    const instantane = snapshot();
    await store.remplacerEtatServeur(instantane, "2026-10-06T10:00:01.000Z");
    const etat = await store.lireEtatServeur();

    expect(etat.curseur).toBe("curseur-1");
    expect(etat.synchroniseLe).toBe("2026-10-06T10:00:01.000Z");
    expect(etat.suiviPoids).toEqual(instantane.suiviPoids);
    expect(etat.mesures.map((m) => [m.id, m.poidsKg, m.source, m.statut])).toEqual([
      ["m-1", 79.5, "automatique", "valide"],
      ["m-0", 79.8, "automatique", "valide"],
    ]);
    expect(etat.alimentation?.ciblesMacros).toEqual(instantane.alimentation?.ciblesMacros);
    expect(etat.alimentation?.journaux).toEqual(instantane.alimentation?.journaux);
    expect(etat.favoris).toEqual([riz]);
  });

  it("remplace intégralement l'état précédent", async () => {
    await store.remplacerEtatServeur(snapshot(), "t1");
    await store.remplacerEtatServeur(
      snapshot({ curseur: "c2", suiviPoids: null, mesures: [], alimentation: null, favoris: [] }),
      "t2",
    );
    expect(await store.lireEtatServeur()).toMatchObject({
      curseur: "c2",
      suiviPoids: null,
      mesures: [],
      alimentation: null,
      favoris: [],
    });
  });

  it("garde la file d'attente dans l'ordre, à travers les instantanés", async () => {
    await store.enfiler({ id: "op-1", type: "retrait-aliment", entreeId: "e-1" }, "2026-10-06T10:00:00.000Z");
    await store.enfiler(
      { id: "op-2", type: "saisie-poids", mesureId: "m-9", poidsKg: 79, saisiLe: "2026-10-06T10:01:00.000Z" },
      "2026-10-06T10:01:00.000Z",
    );
    await store.remplacerEtatServeur(snapshot(), "t");
    await store.noterTentative(["op-2"]);

    expect(await store.operations()).toEqual([
      { id: "op-1", type: "retrait-aliment", entreeId: "e-1", creeLe: "2026-10-06T10:00:00.000Z", tentatives: 0 },
      expect.objectContaining({ id: "op-2", type: "saisie-poids", poidsKg: 79, tentatives: 1 }),
    ]);
    await store.retirerOperations(["op-1"]);
    expect((await store.operations()).map((op) => op.id)).toEqual(["op-2"]);
  });

  it("garde les aliments récents même quand les favoris changent", async () => {
    await store.noterRecent(pomme, "2026-10-06T09:00:00.000Z");
    await store.remplacerEtatServeur(snapshot({ favoris: [] }), "t");
    const etat = await store.lireEtatServeur();
    expect(etat.favoris).toEqual([]);
    expect(etat.recents).toEqual([{ ...pomme, utiliseLe: "2026-10-06T09:00:00.000Z" }]);
  });

  it("limite les récents aux 8 derniers", async () => {
    for (let i = 0; i < 10; i += 1) {
      await store.noterRecent(
        { ...pomme, id: `aliment-${i}`, nom: `Aliment ${i}` },
        `2026-10-06T09:0${i}:00.000Z`,
      );
    }
    const { recents } = await store.lireEtatServeur();
    expect(recents).toHaveLength(8);
    expect(recents.map((r) => r.id)).not.toContain("aliment-0");
  });

  it("efface tout à la déconnexion ou au changement de compte", async () => {
    await store.remplacerEtatServeur(snapshot(), "t");
    await store.enfiler({ id: "op-1", type: "retrait-aliment", entreeId: "e-1" }, "t");
    await store.ouvrir("u-2");
    expect((await store.lireEtatServeur()).suiviPoids).toBeNull();
    expect(await store.operations()).toEqual([]);

    await store.remplacerEtatServeur(snapshot(), "t");
    await store.vider();
    await store.ouvrir("u-2");
    expect((await store.lireEtatServeur()).mesures).toEqual([]);
  });

  it("conserve les données en rouvrant le même compte", async () => {
    await store.remplacerEtatServeur(snapshot(), "t");
    await store.ouvrir("u-1");
    expect((await store.lireEtatServeur()).curseur).toBe("curseur-1");
  });
});
