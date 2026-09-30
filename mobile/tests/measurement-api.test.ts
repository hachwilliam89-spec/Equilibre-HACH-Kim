import {
  measurementSchema,
  weightTrackingSchema,
} from "../src/measurements/api";

const measurement = {
  id: "measurement-1",
  userId: "user-1",
  planId: "plan-1",
  poidsKg: 72.5,
  receivedAt: "2026-09-30T08:00:00.000Z",
  jourUtc: "2026-09-30",
  source: "automatique",
  statut: "valide",
} as const;

test("valide le contrat de l’historique", () => {
  expect(measurementSchema.parse(measurement)).toEqual(measurement);
});

test("valide le suivi et le cas sans plan actif", () => {
  expect(weightTrackingSchema.parse(null)).toBeNull();
  const tracking = weightTrackingSchema.parse({
      statut: "dans-les-clous",
      plan: {
        id: "plan-1",
        poidsDepart: 75,
        poidsCible: 70,
        dateDebut: "2026-09-01T00:00:00.000Z",
        dateCible: "2026-10-01T00:00:00.000Z",
        imcCible: 22,
        niveauActivite: "sportif",
        budgetCalorique: 1900,
        budgetPlafonneAuBmr: false,
        statut: "actif",
      },
      derniereMesure: measurement,
      poidsAttendu: 72.5,
      ecartKg: 0,
    });
  expect(tracking?.statut).toBe("dans-les-clous");
});
