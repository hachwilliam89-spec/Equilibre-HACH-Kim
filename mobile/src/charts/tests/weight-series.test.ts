import {
  chartCoordinates,
  validWeightPoints,
  WEIGHT_CHART_FRAME,
  weightChartWindow,
} from "../weight-series";
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
  expect(coordinates.target[0].x).toBe(WEIGHT_CHART_FRAME.left);
  expect(coordinates.target[1].x).toBe(WEIGHT_CHART_FRAME.right);
  expect(coordinates.actual[0].x).toBe(108);
  expect(coordinates.actual[0].y).toBeGreaterThan(coordinates.target[0].y);
  expect(coordinates.ticks.map(({ weightKg }) => weightKg)).toEqual([77, 80, 83]);
});

it("rend la cible sans inventer de pesée quand le plan n'a pas encore de mesure", () => {
  const coordinates = chartCoordinates(plan, []);
  expect(coordinates.actual).toEqual([]);
  expect(coordinates.segments).toEqual([]);
  expect(coordinates.target).toHaveLength(2);
});

it("signale les jours sans pesée dans la courbe sans créer de valeur intermédiaire", () => {
  const coordinates = chartCoordinates(plan, [
    { dayUtc: "2026-10-01", weightKg: 82 },
    { dayUtc: "2026-10-02", weightKg: 81 },
    { dayUtc: "2026-10-05", weightKg: 79 },
  ]);
  expect(coordinates.actual).toHaveLength(3);
  expect(coordinates.segments.map(({ hasGap }) => hasGap)).toEqual([false, true]);
  expect(coordinates.actual[2].x).toBe(WEIGHT_CHART_FRAME.right);
});

it("espace les jours UTC régulièrement, même au changement d'heure", () => {
  const coordinates = chartCoordinates(
    { ...plan, dateDebut: "2026-10-24", dateCible: "2026-10-26" },
    [{ dayUtc: "2026-10-25", weightKg: 81 }],
  );
  expect(coordinates.actual[0].x).toBe(174);
});

it("propose 7, 30 et 90 jours dès le début du plan", () => {
  const longPlan = { ...plan, dateCible: "2027-01-31" };
  expect(weightChartWindow(longPlan, 7, "2026-10-03")).toEqual({
    startUtc: "2026-10-01", endUtc: "2026-10-07",
  });
  expect(weightChartWindow(longPlan, 30, "2026-10-03")).toEqual({
    startUtc: "2026-10-01", endUtc: "2026-10-30",
  });
  expect(weightChartWindow(longPlan, 90, "2026-10-03")).toEqual({
    startUtc: "2026-10-01", endUtc: "2026-12-29",
  });
  expect(weightChartWindow(longPlan, "plan", "2026-10-03")).toEqual({
    startUtc: "2026-10-01", endUtc: "2027-01-31",
  });
});

it("fait glisser la fenêtre en jours UTC puis la borne à la fin du plan", () => {
  const longPlan = { ...plan, dateCible: "2026-12-31" };
  expect(weightChartWindow(longPlan, 7, "2026-10-25")).toEqual({
    startUtc: "2026-10-19", endUtc: "2026-10-25",
  });
  expect(weightChartWindow(longPlan, 7, "2027-01-05")).toEqual({
    startUtc: "2026-12-25", endUtc: "2026-12-31",
  });
  expect(weightChartWindow(plan, 90, "2026-10-01")).toEqual({
    startUtc: "2026-10-01", endUtc: "2026-10-05",
  });
});

it("recentre les mesures et l'échelle verticale sur la période choisie", () => {
  const longPlan = { ...plan, dateCible: "2026-12-31" };
  const points = [
    { dayUtc: "2026-10-01", weightKg: 82 },
    { dayUtc: "2026-10-04", weightKg: 81.5 },
    { dayUtc: "2026-10-20", weightKg: 80 },
  ];
  const coordinates = chartCoordinates(
    longPlan, points, weightChartWindow(longPlan, 7, "2026-10-04"),
  );
  expect(coordinates.visiblePoints).toEqual(points.slice(0, 2));
  expect(coordinates.actual).toHaveLength(2);
  expect(coordinates.actual[0].x).toBe(WEIGHT_CHART_FRAME.left);
  expect(coordinates.actual[1].x).toBe(174);
  expect(coordinates.target[1].y).toBeGreaterThan(coordinates.target[0].y);
  expect(coordinates.low).toBeGreaterThan(chartCoordinates(longPlan, points).low);
});
