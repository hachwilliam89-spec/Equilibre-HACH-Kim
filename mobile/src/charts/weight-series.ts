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
  const start = dayTime(day(plan.dateDebut));
  const end = dayTime(day(plan.dateCible));
  const duration = Math.max(end - start, 1);
  const weights = [plan.poidsDepart, plan.poidsCible, ...points.map((p) => p.weightKg)];
  const low = Math.floor(Math.min(...weights) - 1);
  const high = Math.ceil(Math.max(...weights) + 1);
  const height = Math.max(high - low, 1);
  const x = (dayUtc: string) => 24 + ((dayTime(dayUtc) - start) / duration) * 272;
  const y = (weightKg: number) => 150 - ((weightKg - low) / height) * 120;
  return {
    low,
    high,
    target: [
      { x: 24, y: y(plan.poidsDepart) },
      { x: 296, y: y(plan.poidsCible) },
    ],
    actual: points.map((point) => ({ x: x(point.dayUtc), y: y(point.weightKg) })),
  };
}
