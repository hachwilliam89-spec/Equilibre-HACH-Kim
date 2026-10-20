import { adjustmentBody, budgetSchema, goalsSchema, weeklyRate } from "../src/plans/form";
const valid = { poidsDepart: "80,5", poidsCible: "78,5", dateDebut: "2026-09-23", dateCible: "2026-10-21" };
test("accepte les decimales francaises et calcule le rythme sur la duree exacte", () => {
  const parsed = goalsSchema.parse(valid);
  expect(parsed.poidsDepart).toBe(80.5);
  expect(weeklyRate(parsed.poidsDepart, parsed.poidsCible, parsed.dateDebut, parsed.dateCible)).toBe(0.5);
});
test.each([{ dateCible: "2026-09-23" }, { dateCible: "2026-02-30" }, { poidsCible: "80,5" }, { poidsDepart: "" }, { poidsDepart: "-2" }])("refuse les objectifs invalides %j", (overrides) => {
  expect(goalsSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
});
test("le budget manuel doit etre strictement positif", () => {
  expect(budgetSchema.safeParse("").success).toBe(false);
  expect(budgetSchema.safeParse("0").success).toBe(false);
  expect(budgetSchema.parse("1850,5")).toBe(1850.5);
});

describe("ajustement du plan actif (US5)", () => {
  const plan = { poidsDepart: 82, poidsCible: 78, dateDebut: "2026-10-01T00:00:00.000Z", dateCible: "2026-11-26T00:00:00.000Z", budgetCalorique: 1800 };
  const context = { tailleCm: 170, automatic: true, today: "2026-10-20" };
  const fields = { poidsCible: "78", dateCible: "2026-11-26", budget: "1800" };

  test("n'envoie que les champs modifiés et laisse l'API recalculer le budget", () => {
    const result = adjustmentBody(plan, { ...fields, poidsCible: "79,5" }, context);
    expect(result).toEqual({
      ok: true,
      body: { poidsCible: 79.5 },
      changes: ["Poids cible : 78 kg → 79,5 kg", "Budget : recalculé pour le nouvel objectif"],
    });
  });

  test("envoie le budget saisi, et toujours si le profil est incomplet", () => {
    const budget = adjustmentBody(plan, { ...fields, budget: "1650" }, context);
    expect(budget.ok && budget.body).toEqual({ budgetCalorique: 1650 });
    const incomplet = adjustmentBody(plan, { ...fields, dateCible: "2026-12-10" }, { ...context, automatic: false });
    expect(incomplet.ok && incomplet.body).toEqual({ dateCible: "2026-12-10", budgetCalorique: 1800 });
  });

  test("applique les règles de la création", () => {
    const rapide = adjustmentBody(plan, { ...fields, poidsCible: "72" }, context);
    expect(!rapide.ok && rapide.errors.dateCible).toContain("Rythme maximal");
    const imc = adjustmentBody(plan, { ...fields, poidsCible: "50", dateCible: "2027-12-01" }, context);
    expect(!imc.ok && imc.errors.poidsCible).toContain("18,5");
    const passee = adjustmentBody(plan, { ...fields, dateCible: "2026-10-15" }, context);
    expect(!passee.ok && passee.errors.dateCible).toContain("passée");
    const vide = adjustmentBody(plan, fields, context);
    expect(!vide.ok && vide.errors.form).toBe("Aucune modification à enregistrer.");
  });
});
