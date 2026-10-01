import type { Measurement, WeightTracking } from "./api";

type TrackingStatus = NonNullable<WeightTracking>["statut"];

export const trackingPresentation: Record<
  TrackingStatus,
  { label: string; symbol: string; background: string; color: string }
> = {
  "dans-les-clous": {
    label: "Dans les clous",
    symbol: "✓",
    background: "#e1f5eb",
    color: "#087454",
  },
  "ecart-detecte": {
    label: "Écart détecté",
    symbol: "!",
    background: "#fff0dc",
    color: "#9a4d00",
  },
  "pas-de-donnees-recentes": {
    label: "Pas de données récentes",
    symbol: "○",
    background: "#edf1f0",
    color: "#536861",
  },
  "en-attente-premiere-mesure": {
    label: "En attente de la première mesure",
    symbol: "…",
    background: "#eaf0ff",
    color: "#315da8",
  },
};

export const measurementStatusLabel: Record<Measurement["statut"], string> = {
  valide: "Valide",
  suspecte: "Suspecte",
  "hors-plan": "Hors plan",
};

export const measurementSourceLabel: Record<Measurement["source"], string> = {
  automatique: "Balance",
  manuelle: "Manuelle",
};

export function canSubmitManualCorrection(
  history: Pick<Measurement, "jourUtc" | "source" | "statut">[],
  todayUtc = new Date().toISOString().slice(0, 10),
): boolean {
  return !history.some(
    (measurement) =>
      measurement.jourUtc === todayUtc &&
      (measurement.statut === "valide" || measurement.source === "manuelle"),
  );
}

export function formatWeight(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} kg`;
}

export function formatSignedWeight(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")} kg`;
}

export function formatUtcDay(value: string): string {
  return value.slice(0, 10).split("-").reverse().join("/");
}
