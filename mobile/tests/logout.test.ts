import { logoutMessage } from "../src/auth/useLogout";

test("prévient des modifications qui seraient perdues à la déconnexion", () => {
  expect(logoutMessage(0)).toBe("Vous devrez saisir à nouveau vos identifiants.");
  expect(logoutMessage(1)).toMatch(/^1 modification n’a pas encore été envoyée/);
  expect(logoutMessage(3)).toMatch(/^3 modifications n’ont pas encore été envoyées/);
});
