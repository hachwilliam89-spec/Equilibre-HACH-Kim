import {
  displayName,
  hasIdentity,
  identitySchema,
  initials,
  lastActivityLabel,
  matchesSearch,
  normalizeSearch,
} from "../identity";

const paul = { email: "paul.martin@equilibre.fr", prenom: "Paul", nom: "Martin" };
const ancien = { email: "user2@equilibre.fr" };

describe("identité", () => {
  it("affiche prénom et nom, ou l'e-mail pour un ancien compte", () => {
    expect(displayName(paul)).toBe("Paul Martin");
    expect(displayName(ancien)).toBe("user2@equilibre.fr");
    expect(displayName({ ...ancien, prenom: "Léa" })).toBe("user2@equilibre.fr");
  });

  it("calcule les initiales", () => {
    expect(initials(paul)).toBe("PM");
    expect(initials({ email: "x@y.fr", prenom: "éloïse", nom: "durand" })).toBe("ÉD");
    expect(initials(ancien)).toBe("U");
  });

  it("détecte une identité incomplète", () => {
    expect(hasIdentity(paul)).toBe(true);
    expect(hasIdentity({ ...paul, nom: "  " })).toBe(false);
    expect(hasIdentity(null)).toBe(false);
  });

  it("valide prénom et nom (espaces retirés, 1 à 50 caractères)", () => {
    expect(identitySchema.parse({ prenom: "  Paul ", nom: "Martin" })).toEqual({ prenom: "Paul", nom: "Martin" });
    expect(identitySchema.safeParse({ prenom: " ", nom: "Martin" }).success).toBe(false);
    expect(identitySchema.safeParse({ prenom: "Paul", nom: "x".repeat(51) }).success).toBe(false);
    expect(identitySchema.safeParse({ prenom: "Paul", nom: "x".repeat(50) }).success).toBe(true);
  });
});

describe("recherche du coach", () => {
  it("ignore les accents et la casse", () => {
    expect(normalizeSearch(" Éloïse ")).toBe("eloise");
    expect(matchesSearch({ email: "e@x.fr", prenom: "Éloïse", nom: "Durand" }, "eloise")).toBe(true);
  });

  it("cherche dans le prénom, le nom et l'e-mail, mot par mot", () => {
    expect(matchesSearch(paul, "martin")).toBe(true);
    expect(matchesSearch(paul, "paul mar")).toBe(true);
    expect(matchesSearch(paul, "equilibre.fr")).toBe(true);
    expect(matchesSearch(paul, "paul dupont")).toBe(false);
    expect(matchesSearch(ancien, "user2")).toBe(true);
  });

  it("une recherche vide garde tout le monde", () => {
    expect(matchesSearch(paul, "   ")).toBe(true);
  });
});

describe("dernière activité", () => {
  const now = new Date(2026, 9, 9, 10, 0);

  it("formule l'ancienneté en jours calendaires", () => {
    expect(lastActivityLabel(new Date(2026, 9, 9, 7, 0).toISOString(), now)).toBe("Actif aujourd’hui");
    expect(lastActivityLabel(new Date(2026, 9, 8, 23, 30).toISOString(), now)).toBe("Actif hier");
    expect(lastActivityLabel(new Date(2026, 9, 5, 12, 0).toISOString(), now)).toBe("Inactif depuis 4 jours");
  });

  it("gère l'absence d'activité", () => {
    expect(lastActivityLabel(null, now)).toBe("Aucune activité");
    expect(lastActivityLabel("pas une date", now)).toBe("Aucune activité");
  });
});
