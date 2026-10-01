import {
  correctWeight,
  manualCorrectionSchema,
  measurementSchema,
  weightTrackingSchema,
} from "../src/measurements/api";
import { requestApi } from "../src/plans/api";

jest.mock("../src/plans/api", () => ({ requestApi: jest.fn() }));

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

test("valide uniquement un poids de correction strictement positif", () => {
  expect(manualCorrectionSchema.parse({ poidsKg: 72.4 })).toEqual({
    poidsKg: 72.4,
  });
  expect(manualCorrectionSchema.safeParse({ poidsKg: 0 }).success).toBe(false);
  expect(
    manualCorrectionSchema.safeParse({ poidsKg: Number.NaN }).success,
  ).toBe(false);
});

test("envoie la correction manuelle sur la route dédiée", async () => {
  (requestApi as jest.Mock).mockResolvedValue({
    ...measurement,
    source: "manuelle",
  });

  await expect(correctWeight({ poidsKg: 72.5 })).resolves.toMatchObject({
    poidsKg: 72.5,
    source: "manuelle",
  });
  expect(requestApi).toHaveBeenCalledWith("/measurements/correction", "POST", {
    poidsKg: 72.5,
  });
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
