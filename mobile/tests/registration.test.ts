import { registrationSchema } from "../src/auth/contracts";

const credentials = { prenom: "Paul", nom: "Martin", email: "test@example.test", password: "password123" };
test("un utilisateur doit fournir un code de coach valide", () => {
  expect(registrationSchema.safeParse({ ...credentials, role: "utilisateur" }).success).toBe(false);
  expect(registrationSchema.safeParse({ ...credentials, role: "utilisateur", coachCode: "invalide" }).success).toBe(false);
  expect(registrationSchema.safeParse({ ...credentials, role: "utilisateur", coachCode: "EQ-7A9B2C4D", tailleCm: 170 }).success).toBe(true);
});
test("un compte coach n’envoie pas un code conservé du formulaire utilisateur", () => {
  expect(registrationSchema.parse({ ...credentials, role: "coach", coachCode: "ancien-code", tailleCm: 170, age: 30, sexe: "femme" })).toEqual({ ...credentials, role: "coach" });
});

const user = { ...credentials, role: "utilisateur", coachCode: "EQ-7A9B2C4D", tailleCm: 170 };
test.each([{ tailleCm: undefined }, { tailleCm: 0 }, { tailleCm: NaN }, { age: 0 }, { age: 30.5 }, { age: NaN }])("refuse un profil invalide %j", (profile) => {
  expect(registrationSchema.safeParse({ ...user, ...profile }).success).toBe(false);
});
test("transmet le profil pour permettre la proposition automatique du coach", () => {
  expect(registrationSchema.parse({ ...user, age: 30, sexe: "femme" })).toEqual({ ...user, age: 30, sexe: "femme" });
});

test.each(["coach", "utilisateur"] as const)("le prénom et le nom sont obligatoires (%s)", (role) => {
  const base = { ...user, role };
  expect(registrationSchema.safeParse({ ...base, prenom: "  " }).success).toBe(false);
  expect(registrationSchema.safeParse({ ...base, nom: undefined }).success).toBe(false);
  expect(registrationSchema.safeParse({ ...base, nom: "x".repeat(51) }).success).toBe(false);
});
test("retire les espaces autour du prénom et du nom", () => {
  expect(registrationSchema.parse({ ...credentials, prenom: "  Paul ", nom: " Martin ", role: "coach" })).toEqual({ ...credentials, role: "coach" });
});
