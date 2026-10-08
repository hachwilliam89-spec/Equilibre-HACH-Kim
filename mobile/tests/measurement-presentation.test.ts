import {
  canSubmitManualCorrection,
  formatSignedWeight,
  formatUtcDay,
  formatWeight,
  goalProgress,
  measurementSourceLabel,
  measurementStatusLabel,
  trackingPresentation,
} from "../src/measurements/presentation";

const today = "2026-10-01";

test("propose la correction sans mesure bloquante ou après une anomalie", () => {
  expect(canSubmitManualCorrection([], today)).toBe(true);
  expect(
    canSubmitManualCorrection(
      [{ jourUtc: today, source: "automatique", statut: "suspecte" }],
      today,
    ),
  ).toBe(true);
});

test("masque la correction après une mesure valide ou une correction hors plan", () => {
  expect(
    canSubmitManualCorrection(
      [{ jourUtc: today, source: "automatique", statut: "valide" }],
      today,
    ),
  ).toBe(false);
  expect(
    canSubmitManualCorrection(
      [{ jourUtc: today, source: "manuelle", statut: "hors-plan" }],
      today,
    ),
  ).toBe(false);
});

test("présente tous les statuts sans dépendre uniquement de la couleur", () => {
  expect(Object.keys(trackingPresentation)).toHaveLength(4);
  for (const status of Object.values(trackingPresentation)) {
    expect(status.label).not.toBe("");
    expect(status.symbol).not.toBe("");
  }
});

test("formate les valeurs et les dates affichées", () => {
  expect(formatWeight(72)).toBe("72,0 kg");
  expect(formatSignedWeight(1.25)).toBe("+1,3 kg");
  expect(formatSignedWeight(-0.75)).toBe("-0,8 kg");
  expect(formatUtcDay("2026-09-30T12:00:00.000Z")).toBe("30/09/2026");
});

test("présente toutes les sources et tous les statuts de mesure", () => {
  expect(measurementSourceLabel).toEqual({
    automatique: "Balance",
    manuelle: "Manuelle",
  });
  expect(measurementStatusLabel).toEqual({
    valide: "Valide",
    suspecte: "Suspecte",
    "hors-plan": "Hors plan",
  });
});

test("calcule l'avancement vers le poids cible, en perte comme en prise", () => {
  expect(goalProgress(75, 70, 74)).toEqual({ fraction: 0.2, parcouruKg: 1, totalKg: 5 });
  expect(goalProgress(60, 64, 62)).toEqual({ fraction: 0.5, parcouruKg: 2, totalKg: 4 });
});

test("borne l'avancement quand le poids s'éloigne ou dépasse la cible", () => {
  expect(goalProgress(75, 70, 76).fraction).toBe(0);
  expect(goalProgress(75, 70, 69)).toEqual({ fraction: 1, parcouruKg: 5, totalKg: 5 });
  expect(goalProgress(70, 70, 70).fraction).toBe(1);
});
