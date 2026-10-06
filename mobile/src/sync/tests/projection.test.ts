import { emptyServerState, type LocalOperation, type ServerState } from "../contracts";
import { projeter, statutBudget } from "../projection";
import { PLAN_ID, pomme, riz, snapshot } from "./fixtures";

const maintenant = new Date("2026-10-06T12:00:00.000Z");
const serveur = (): ServerState => ({
  ...emptyServerState(),
  ...snapshot(),
  synchroniseLe: "2026-10-06T10:00:00.000Z",
});
const ajout = (id: string, consommeLe: string, food = pomme, quantiteGrammes = 150): LocalOperation => ({
  id: `op-${id}`,
  type: "ajout-aliment",
  entreeId: id,
  foodId: food.id,
  quantiteGrammes,
  categorieRepas: "collation",
  consommeLe,
  aliment: food,
});

describe("projeter : état serveur + file d'attente", () => {
  it("restitue l'état serveur tel quel sans opération en attente", () => {
    const vue = projeter(serveur(), [], maintenant);
    expect(vue.operationsEnAttente).toBe(0);
    expect(vue.alimentation?.journaux[0].totalCaloriesKcal).toBe(260);
    expect(vue.alimentation?.statut).toMatchObject({ statut: "dans-le-budget", ecartKcal: -1540 });
    expect(vue.mesures.every((m) => !m.enAttente)).toBe(true);
  });

  it("ajoute une entrée hors ligne avec les valeurs calculées comme le serveur", () => {
    const vue = projeter(serveur(), [ajout("e-2", "2026-10-06T11:00:00.000Z")], maintenant);
    const today = vue.alimentation?.journaux.find((j) => j.jourUtc === "2026-10-06");
    expect(today?.entrees).toContainEqual(
      expect.objectContaining({ id: "e-2", caloriesKcal: 78, proteinesG: 0.45, enAttente: true }),
    );
    expect(today?.totalCaloriesKcal).toBe(338);
    expect(vue.operationsEnAttente).toBe(1);
  });

  it("crée le journal d'un jour absent de l'instantané", () => {
    const vue = projeter(serveur(), [ajout("e-2", "2026-10-05T20:00:00.000Z")], maintenant);
    expect(vue.alimentation?.journaux.map((j) => j.jourUtc)).toEqual(["2026-10-06", "2026-10-05"]);
  });

  it("masque une entrée retirée hors ligne et recalcule le total", () => {
    const vue = projeter(serveur(), [{ id: "op-r", type: "retrait-aliment", entreeId: "e-1" }], maintenant);
    expect(vue.alimentation?.journaux[0]).toMatchObject({ entrees: [], totalCaloriesKcal: 0 });
    expect(vue.alimentation?.statut.statut).toBe("pas-de-donnees-recentes");
  });

  it("ne duplique pas une entrée déjà présente côté serveur (réponse perdue)", () => {
    const vue = projeter(
      serveur(),
      [{ ...ajout("e-1", "2026-10-06T09:00:00.000Z", riz, 200) }],
      maintenant,
    );
    expect(vue.alimentation?.journaux[0].entrees).toHaveLength(1);
  });

  it("affiche une saisie de poids en attente en tête d'historique", () => {
    const vue = projeter(
      serveur(),
      [{ id: "op-p", type: "saisie-poids", mesureId: "m-9", poidsKg: 79.1, saisiLe: "2026-10-06T11:30:00.000Z" }],
      maintenant,
    );
    expect(vue.mesures[0]).toMatchObject({
      id: "m-9",
      planId: PLAN_ID,
      source: "manuelle",
      jourUtc: "2026-10-06",
      enAttente: true,
    });
  });

  it("applique les favoris en attente", () => {
    const vue = projeter(
      serveur(),
      [
        { id: "op-f1", type: "favori", foodId: pomme.id, favori: true, aliment: pomme },
        { id: "op-f2", type: "favori", foodId: riz.id, favori: false, aliment: riz },
      ],
      maintenant,
    );
    expect(vue.favoris).toEqual([pomme]);
  });

  it("reste dans le budget à +150 kcal et passe en dépassement au-delà", () => {
    const limite = projeter(serveur(), [ajout("e-2", "2026-10-06T11:00:00.000Z", riz, 1300)], maintenant);
    expect(limite.alimentation?.statut).toMatchObject({ statut: "dans-le-budget", ecartKcal: 150 });
    const depasse = projeter(serveur(), [ajout("e-2", "2026-10-06T11:00:00.000Z", riz, 1350)], maintenant);
    expect(depasse.alimentation?.statut).toMatchObject({ statut: "depassement", ecartKcal: 215 });
  });
});

describe("statutBudget (règle serveur reprise)", () => {
  const journal = (jourUtc: string, kcal: number) => ({
    planId: PLAN_ID,
    jourUtc,
    budgetCalorique: 1800,
    entrees: [
      { id: jourUtc, foodId: riz.id, nom: "Riz", quantiteGrammes: 100, caloriesKcal: kcal, proteinesG: 0, glucidesG: 0, lipidesG: 0, categorieRepas: "dejeuner" as const, receivedAt: `${jourUtc}T09:00:00Z`, enAttente: false },
    ],
    totalCaloriesKcal: kcal,
    totalProteinesG: 0,
    totalGlucidesG: 0,
    totalLipidesG: 0,
  });

  it("utilise le journal d'hier si aujourd'hui est vide", () => {
    expect(statutBudget(1800, [journal("2026-10-05", 1950)], "2026-10-06")).toMatchObject({
      statut: "dans-le-budget",
      ecartKcal: 150,
    });
  });

  it("ignore un journal plus ancien qu'hier", () => {
    expect(statutBudget(1800, [journal("2026-10-04", 2500)], "2026-10-06").statut).toBe(
      "pas-de-donnees-recentes",
    );
  });
});
