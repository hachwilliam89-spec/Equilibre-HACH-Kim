import type { Measurement } from "../measurements/api";

export interface WeightPlan {
  id: string;
  poidsDepart: number;
  poidsCible: number;
  dateDebut: string;
  dateCible: string;
}

export interface WeightPoint {
  dayUtc: string;
  weightKg: number;
}

// Le repère est partagé par les axes et les séries. Le viewBox SVG l'adapte
// à la largeur disponible sans modifier les calculs de dates et de poids.
export const WEIGHT_CHART_FRAME = {
  width: 320,
  height: 192,
  left: 42,
  right: 306,
  top: 16,
  bottom: 158,
} as const;

const dayTime = (dayUtc: string) => Date.parse(`${dayUtc}T00:00:00Z`);
const day = (value: string) => value.slice(0, 10);

export function validWeightPoints(
  plan: WeightPlan,
  measurements: Measurement[],
): WeightPoint[] {
  const start = day(plan.dateDebut);
  const end = day(plan.dateCible);
  const current = new Map<string, Measurement>();
  for (const measurement of measurements) {
    if (
      measurement.planId !== plan.id ||
      measurement.statut !== "valide" ||
      measurement.jourUtc < start ||
      measurement.jourUtc > end
    ) continue;
    const previous = current.get(measurement.jourUtc);
    if (!previous || measurement.receivedAt > previous.receivedAt) {
      current.set(measurement.jourUtc, measurement);
    }
  }
  return [...current.values()]
    .sort((a, b) => a.jourUtc.localeCompare(b.jourUtc))
    .map((measurement) => ({
      dayUtc: measurement.jourUtc,
      weightKg: measurement.poidsKg,
    }));
}

export function chartCoordinates(plan: WeightPlan, points: WeightPoint[]) {
  const frame = WEIGHT_CHART_FRAME;
  const start = dayTime(day(plan.dateDebut));
  const end = dayTime(day(plan.dateCible));
  const duration = Math.max(end - start, 1);
  const weights = [plan.poidsDepart, plan.poidsCible, ...points.map((p) => p.weightKg)];
  const low = Math.floor(Math.min(...weights) - 1);
  const high = Math.ceil(Math.max(...weights) + 1);
  const height = Math.max(high - low, 1);
  const x = (dayUtc: string) =>
    frame.left + ((dayTime(dayUtc) - start) / duration) * (frame.right - frame.left);
  const y = (weightKg: number) =>
    frame.bottom - ((weightKg - low) / height) * (frame.bottom - frame.top);
  return {
    low,
    high,
    ticks: [low, (low + high) / 2, high].map((weightKg) => ({
      weightKg,
      y: y(weightKg),
    })),
    target: [
      { x: frame.left, y: y(plan.poidsDepart) },
      { x: frame.right, y: y(plan.poidsCible) },
    ],
    actual: points.map((point) => ({
      dayUtc: point.dayUtc,
      x: x(point.dayUtc),
      y: y(point.weightKg),
    })),
    segments: points.slice(1).map((point, index) => ({
      from: { x: x(points[index].dayUtc), y: y(points[index].weightKg) },
      to: { x: x(point.dayUtc), y: y(point.weightKg) },
      hasGap: dayTime(point.dayUtc) - dayTime(points[index].dayUtc) > 86_400_000,
    })),
  };
}
