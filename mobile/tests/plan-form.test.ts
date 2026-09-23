import { budgetSchema, goalsSchema, weeklyRate } from "../src/plans/form";
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
