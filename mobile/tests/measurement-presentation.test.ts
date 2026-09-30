import {
  formatSignedWeight,
  formatUtcDay,
  formatWeight,
  measurementSourceLabel,
  measurementStatusLabel,
  trackingPresentation,
} from "../src/measurements/presentation";

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
