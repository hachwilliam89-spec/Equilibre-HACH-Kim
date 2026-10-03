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

export type WeightChartRange = 7 | 30 | 90 | "plan";

export interface WeightChartWindow {
  startUtc: string;
  endUtc: string;
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

const DAY_MS = 86_400_000;
const dayTime = (dayUtc: string) => Date.parse(`${dayUtc}T00:00:00Z`);
const day = (value: string) => value.slice(0, 10);
const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function weightChartWindow(
  plan: WeightPlan,
  range: WeightChartRange,
  todayUtc: string,
): WeightChartWindow {
  const planStart = dayTime(day(plan.dateDebut));
  const planEnd = dayTime(day(plan.dateCible));
  if (range === "plan") {
    return { startUtc: day(plan.dateDebut), endUtc: day(plan.dateCible) };
  }

  // Au début du plan, afficher aussi les prochains jours évite un graphique
  // réduit à un seul point. Ensuite, la fenêtre glisse avec le jour UTC.
  const windowEnd = Math.min(
    planEnd,
    Math.max(planStart + (range - 1) * DAY_MS, dayTime(day(todayUtc))),
  );
  return {
    startUtc: utcDay(Math.max(planStart, windowEnd - (range - 1) * DAY_MS)),
    endUtc: utcDay(windowEnd),
  };
}

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

export function chartCoordinates(
  plan: WeightPlan,
  points: WeightPoint[],
  window: WeightChartWindow = {
    startUtc: day(plan.dateDebut),
    endUtc: day(plan.dateCible),
  },
) {
  const frame = WEIGHT_CHART_FRAME;
  const planStart = dayTime(day(plan.dateDebut));
  const planDuration = Math.max(dayTime(day(plan.dateCible)) - planStart, 1);
  const start = dayTime(window.startUtc);
  const end = dayTime(window.endUtc);
  const duration = Math.max(end - start, 1);
  const visiblePoints = points.filter(
    (point) => point.dayUtc >= window.startUtc && point.dayUtc <= window.endUtc,
  );
  const targetWeight = (time: number) =>
    plan.poidsDepart +
    ((time - planStart) / planDuration) * (plan.poidsCible - plan.poidsDepart);
  const targetStart = targetWeight(start);
  const targetEnd = targetWeight(end);
  const weights = [targetStart, targetEnd, ...visiblePoints.map((p) => p.weightKg)];
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
    visiblePoints,
    ticks: [low, (low + high) / 2, high].map((weightKg) => ({
      weightKg,
      y: y(weightKg),
    })),
    target: [
      { x: frame.left, y: y(targetStart) },
      { x: frame.right, y: y(targetEnd) },
    ],
    actual: visiblePoints.map((point) => ({
      dayUtc: point.dayUtc,
      x: x(point.dayUtc),
      y: y(point.weightKg),
    })),
    segments: visiblePoints.slice(1).map((point, index) => ({
      from: { x: x(visiblePoints[index].dayUtc), y: y(visiblePoints[index].weightKg) },
      to: { x: x(point.dayUtc), y: y(point.weightKg) },
      hasGap: dayTime(point.dayUtc) - dayTime(visiblePoints[index].dayUtc) > DAY_MS,
    })),
  };
}
