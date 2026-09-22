import { registrationSchema } from "../src/auth/contracts";

const credentials = { email: "test@example.test", password: "password123" };
test("un utilisateur doit fournir un code de coach valide", () => {
  expect(registrationSchema.safeParse({ ...credentials, role: "utilisateur" }).success).toBe(false);
  expect(registrationSchema.safeParse({ ...credentials, role: "utilisateur", coachCode: "invalide" }).success).toBe(false);
  expect(registrationSchema.safeParse({ ...credentials, role: "utilisateur", coachCode: "EQ-7A9B2C4D" }).success).toBe(true);
});
test("un compte coach n’envoie pas un code conservé du formulaire utilisateur", () => {
  expect(registrationSchema.parse({ ...credentials, role: "coach", coachCode: "ancien-code" })).toEqual({ ...credentials, role: "coach" });
});
