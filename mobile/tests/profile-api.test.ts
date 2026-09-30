import { profileSchema, profileUpdateSchema } from "../src/profile/api";

const profile = {
  id: "813baf66-13bf-43ac-a68a-cb3e2c070c18",
  email: "user@example.test",
  coach: {
    id: "fce92625-c022-4c06-aa34-c476422c9e1d",
    email: "coach@example.test",
  },
  tailleCm: 170,
  age: 32,
  sexe: "femme",
} as const;

test("valide le contrat du profil utilisateur", () => {
  expect(profileSchema.parse(profile)).toEqual(profile);
});

test.each([
  { tailleCm: 0 },
  { tailleCm: Number.NaN },
  { tailleCm: 170, age: 0 },
  { tailleCm: 170, age: 30.5 },
])("refuse une mise à jour invalide : %j", (update) => {
  expect(profileUpdateSchema.safeParse(update).success).toBe(false);
});

test("accepte la taille seule ou un profil métabolique complet", () => {
  expect(profileUpdateSchema.safeParse({ tailleCm: 170 }).success).toBe(true);
  expect(
    profileUpdateSchema.safeParse({ tailleCm: 170, age: 32, sexe: "femme" })
      .success,
  ).toBe(true);
});
