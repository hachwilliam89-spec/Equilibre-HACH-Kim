import { SESSION_EXPIRED_MESSAGE } from "../src/auth/contracts";

test("le message d'expiration rassure sur les saisies conservées", () => {
  expect(SESSION_EXPIRED_MESSAGE).toMatch(/expiré/);
  expect(SESSION_EXPIRED_MESSAGE).toMatch(/conservées/);
});
