import { etatChargement, etatSynchro, messageRejet } from "../presentation";
import { pomme } from "./fixtures";

describe("etatSynchro", () => {
  const maintenant = new Date("2026-10-06T12:00:00");

  it("indique le mode hors ligne et les modifications en attente", () => {
    expect(
      etatSynchro({ enCours: false, horsLigne: true, synchroniseLe: null, operationsEnAttente: 2, maintenant }),
    ).toEqual({ texte: "Hors ligne · 2 modifications en attente", ton: "alerte" });
  });

  it("rassure hors ligne quand rien n'est en attente", () => {
    expect(
      etatSynchro({ enCours: false, horsLigne: true, synchroniseLe: null, operationsEnAttente: 0, maintenant }).texte,
    ).toBe("Hors ligne · tes données restent consultables");
  });

  it("donne l'heure de la dernière synchronisation", () => {
    const etat = etatSynchro({
      enCours: false,
      horsLigne: false,
      synchroniseLe: new Date("2026-10-06T09:05:00").toISOString(),
      operationsEnAttente: 1,
      maintenant,
    });
    expect(etat.texte).toMatch(/^Synchronisé à 09:05 · 1 modification en attente$/);
    expect(etat.ton).toBe("attente");
  });
});

describe("messageRejet", () => {
  it("explique un refus de saisie de poids", () => {
    expect(
      messageRejet({
        operation: { id: "op", type: "saisie-poids", mesureId: "m", poidsKg: 79.5, saisiLe: "x", creeLe: "x", tentatives: 0 },
        code: "measurement-day-conflict",
        message: "Mesure déjà enregistrée",
      }),
    ).toBe("Ton poids saisi (79,5 kg) n’a pas été retenu : une mesure valide existait déjà ce jour-là.");
  });

  it("reprend le message serveur pour un code inconnu", () => {
    expect(
      messageRejet({
        operation: {
          id: "op", type: "ajout-aliment", entreeId: "e", foodId: pomme.id, quantiteGrammes: 100,
          consommeLe: "x", aliment: pomme, creeLe: "x", tentatives: 0,
        },
        code: "autre",
        message: "Refus quelconque.",
      }),
    ).toBe("L’ajout de « Pomme » n’a pas été retenu : refus quelconque.");
  });
});

describe("etatChargement", () => {
  const base = { initialise: true, synchroniseLe: null, enCours: false, horsLigne: false, erreur: null };

  it("affiche les données locales même hors ligne dès qu'une synchro a eu lieu", () => {
    expect(etatChargement({ ...base, synchroniseLe: "t", horsLigne: true })).toEqual({ loading: false, error: "" });
  });

  it("charge pendant la toute première synchronisation", () => {
    expect(etatChargement({ ...base, enCours: true }).loading).toBe(true);
  });

  it("explique qu'une première connexion est nécessaire", () => {
    expect(etatChargement({ ...base, horsLigne: true }).error).toMatch(/première synchronisation/);
  });

  it("remonte une base locale indisponible", () => {
    expect(etatChargement({ ...base, initialise: false, erreur: "Base locale indisponible" })).toEqual({
      loading: false,
      error: "Base locale indisponible",
    });
  });
});
