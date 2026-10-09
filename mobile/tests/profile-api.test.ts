import { profileSchema, profileUpdateSchema } from "../src/profile/api";

const profile = {
  id: "813baf66-13bf-43ac-a68a-cb3e2c070c18",
  email: "user@example.test",
  prenom: "Paul",
  nom: "Martin",
  coach: {
    id: "fce92625-c022-4c06-aa34-c476422c9e1d",
    email: "coach@example.test",
    prenom: "Marie",
    nom: "Dupont",
  },
  tailleCm: 170,
  age: 32,
  sexe: "femme",
} as const;

const identite = { prenom: "Paul", nom: "Martin" };

test("valide le contrat du profil utilisateur", () => {
  expect(profileSchema.parse(profile)).toEqual(profile);
});

test("accepte un ancien compte sans prénom ni nom", () => {
  const { prenom: _p, nom: _n, ...ancien } = profile;
  expect(profileSchema.parse({ ...ancien, coach: { id: profile.coach.id, email: profile.coach.email } }).prenom).toBeUndefined();
});

test.each([
  { ...identite, tailleCm: 0 },
  { ...identite, tailleCm: Number.NaN },
  { ...identite, tailleCm: 170, age: 0 },
  { ...identite, tailleCm: 170, age: 30.5 },
  { tailleCm: 170 },
  { ...identite, prenom: " ", tailleCm: 170 },
])("refuse une mise à jour invalide : %j", (update) => {
  expect(profileUpdateSchema.safeParse(update).success).toBe(false);
});

test("accepte la taille seule ou un profil métabolique complet", () => {
  expect(profileUpdateSchema.safeParse({ ...identite, tailleCm: 170 }).success).toBe(true);
  expect(
    profileUpdateSchema.safeParse({ ...identite, tailleCm: 170, age: 32, sexe: "femme" })
      .success,
  ).toBe(true);
});
