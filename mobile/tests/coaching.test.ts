import { attentionLevel, coachAlerts, sortForCoach, type ClientOverview } from "../src/coaching/api";

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

test("trie par nom de famille, l'e-mail ne servant qu'aux anciens comptes", () => {
  const named = (email: string, prenom: string, nom: string) => ({ ...client(email, "dans-les-clous"), prenom, nom });
  const sorted = sortForCoach([
    named("a@x.fr", "Zoé", "Martin"),
    client("dora@x.fr", "dans-les-clous"),
    named("b@x.fr", "Éloïse", "Durand"),
    named("c@x.fr", "Paul", "Bernard"),
  ]);
  expect(sorted.map((c) => c.email)).toEqual(["c@x.fr", "dora@x.fr", "b@x.fr", "a@x.fr"]);
});

test("explique pourquoi regarder un utilisateur et quoi faire", () => {
  const ecart = client("a", "ecart-detecte", "depassement");
  ecart.suiviPoids!.ecartKg = 1.4;
  ecart.alimentation!.ecartKcal = 312;
  expect(coachAlerts(ecart)).toEqual([
    { raison: "Poids à +1,4 kg de la trajectoire", action: "revoir-plan" },
    { raison: "Calories au-dessus du budget (+312 kcal)", action: "revoir-plan" },
  ]);
  expect(coachAlerts(client("b", "pas-de-donnees-recentes", "pas-de-donnees-recentes")).map((a) => a.action))
    .toEqual(["relancer", "relancer"]);
  expect(coachAlerts(client("c", null, null))).toEqual([{ raison: "Aucun plan actif", action: "creer-plan" }]);
  expect(coachAlerts(client("d", "en-attente-premiere-mesure"))[0].action).toBe("attendre-pesee");
  expect(coachAlerts(client("e", "dans-les-clous"))).toEqual([]);
});

const persistante = (metrique: "poids" | "calories", ecart: number) => ({
  metrique,
  serie: 3,
  depuis: "2026-10-05",
  derniere: { jourUtc: "2026-10-07", ecart, horsTolerance: true },
});

test("place l'écart persistant au-dessus de tout et propose d'ajuster le plan", () => {
  const ecart = { ...client("a", "ecart-detecte", "depassement"), alertes: [persistante("poids", 2.4)] };
  ecart.alimentation!.ecartKcal = 312;
  expect(attentionLevel(ecart)).toBe(3);
  // L'écart persistant remplace l'écart ponctuel du poids, pas celui des calories.
  expect(coachAlerts(ecart)).toEqual([
    { raison: "Poids hors tolérance sur 3 pesées de suite (+2,4 kg)", action: "ajuster-plan" },
    { raison: "Calories au-dessus du budget (+312 kcal)", action: "revoir-plan" },
  ]);
  const calories = { ...client("b", "dans-les-clous", "depassement"), alertes: [persistante("calories", 280)] };
  expect(coachAlerts(calories)).toEqual([
    { raison: "Calories au-delà du budget 3 jours de suite (+280 kcal)", action: "ajuster-plan" },
  ]);
  const sorted = sortForCoach([client("max@x.fr", "ecart-detecte"), { ...client("zoe@x.fr", "dans-les-clous"), alertes: [persistante("poids", -1.6)] }]);
  expect(sorted.map((c) => c.email)).toEqual(["zoe@x.fr", "max@x.fr"]);
});

test("reste compatible avec une API sans alertes persistantes", () => {
  expect(attentionLevel({ ...client("a", "dans-les-clous"), alertes: [] })).toBe(0);
  expect(attentionLevel(client("a", "dans-les-clous"))).toBe(0);
});
