import { chartCoordinates, validWeightPoints } from "../weight-series";
import type { Measurement } from "../../measurements/api";

const plan = {
  id: "plan-1", poidsDepart: 82, poidsCible: 78,
  dateDebut: "2026-10-01", dateCible: "2026-10-05",
};

function measure(overrides: Partial<Measurement>): Measurement {
  return {
    id: "m-1", userId: "u-1", planId: "plan-1", poidsKg: 81,
    jourUtc: "2026-10-02", receivedAt: "2026-10-02T08:00:00Z",
    source: "automatique", statut: "valide", ...overrides,
  };
}

it("trace seulement les mesures valides du plan et garde la dernière du jour", () => {
  const points = validWeightPoints(plan, [
    measure({ id: "suspecte", statut: "suspecte", poidsKg: 90 }),
    measure({ id: "ancien-plan", planId: "plan-0", poidsKg: 95 }),
    measure({ id: "avant", jourUtc: "2026-09-30", poidsKg: 83 }),
    measure({ id: "premiere", poidsKg: 81 }),
    measure({ id: "correction", source: "manuelle", receivedAt: "2026-10-02T16:00:00Z", poidsKg: 80.5 }),
  ]);
  expect(points).toEqual([{ dayUtc: "2026-10-02", weightKg: 80.5 }]);
  const coordinates = chartCoordinates(plan, points);
  expect(coordinates.target[0].x).toBe(24);
  expect(coordinates.target[1].x).toBe(296);
  expect(coordinates.actual[0].x).toBe(92);
});
