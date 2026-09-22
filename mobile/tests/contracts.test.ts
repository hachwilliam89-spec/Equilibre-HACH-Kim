import { credentialsSchema, sessionSchema } from "../src/auth/contracts";

const equal = (actual: unknown, expected: unknown) =>
  expect(actual).toBe(expected);

test("normalise seulement les espaces autour de l’e-mail et conserve le mot de passe", () => {
  const result = credentialsSchema.parse({
    email: " coach@example.test ",
    password: " password123 ",
  });
  equal(result.email, "coach@example.test");
  equal(result.password, " password123 ");
});
test("refuse une adresse invalide et un mot de passe trop court", () => {
  equal(
    credentialsSchema.safeParse({ email: "coach", password: "password123" })
      .success,
    false,
  );
  equal(
    credentialsSchema.safeParse({
      email: "coach@example.test",
      password: "1234567",
    }).success,
    false,
  );
});
test("respecte la limite bcrypt de 72 octets, même avec des caractères Unicode", () => {
  const parse = (password: string) =>
    credentialsSchema.safeParse({ email: "coach@example.test", password })
      .success;
  equal(parse("a".repeat(72)), true);
  equal(parse("a".repeat(73)), false);
  equal(parse("é".repeat(36)), true);
  equal(parse("é".repeat(37)), false);
});
test("refuse une session sans refresh token ou avec un rôle inconnu", () => {
  const session = {
    userId: "eeb5ec60-0be3-4c4b-8ab1-b1dc59b8a10a",
    role: "coach",
    accessToken: "access",
    refreshToken: "refresh",
  };
  equal(sessionSchema.safeParse(session).success, true);
  equal(
    sessionSchema.safeParse({ ...session, refreshToken: "" }).success,
    false,
  );
  equal(sessionSchema.safeParse({ ...session, role: "admin" }).success, false);
});
