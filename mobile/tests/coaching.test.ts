import { attentionLevel, sortForCoach, type ClientOverview } from "../src/coaching/api";

const plan = {
  id: "p",
  poidsDepart: 80,
  poidsCible: 75,
  dateDebut: "2026-10-01T00:00:00.000Z",
  dateCible: "2026-12-31T00:00:00.000Z",
  imcCible: 24,
  niveauActivite: "actif" as const,
  budgetCalorique: 1800,
  budgetPlafonneAuBmr: false,
  statut: "actif" as const,
};

const client = (
  email: string,
  poids: NonNullable<ClientOverview["suiviPoids"]>["statut"] | null,
  alimentation: NonNullable<ClientOverview["alimentation"]>["statut"] | null = "dans-le-budget",
): ClientOverview => ({
  id: email,
  email,
  suiviPoids: poids === null ? null : { statut: poids, plan, derniereMesure: null, poidsAttendu: null, ecartKg: null },
  alimentation: alimentation === null ? null : { statut: alimentation, ecartKcal: null },
});

test("signale un écart de poids ou un dépassement calorique", () => {
  expect(attentionLevel(client("a", "ecart-detecte"))).toBe(2);
  expect(attentionLevel(client("a", "dans-les-clous", "depassement"))).toBe(2);
  expect(attentionLevel(client("a", "dans-les-clous", "pas-de-donnees-recentes"))).toBe(2);
});

test("distingue l'attente d'un plan ou d'une première mesure d'un suivi à jour", () => {
  expect(attentionLevel(client("a", null, null))).toBe(1);
  expect(attentionLevel(client("a", "en-attente-premiere-mesure"))).toBe(1);
  expect(attentionLevel(client("a", "dans-les-clous"))).toBe(0);
});

test("trie les utilisateurs à surveiller en premier puis par e-mail", () => {
  const sorted = sortForCoach([
    client("zoe@x.fr", "dans-les-clous"),
    client("ana@x.fr", null, null),
    client("max@x.fr", "ecart-detecte"),
    client("bob@x.fr", "dans-les-clous"),
  ]);
  expect(sorted.map((c) => c.email)).toEqual(["max@x.fr", "ana@x.fr", "bob@x.fr", "zoe@x.fr"]);
});
