import type { ReferenceFood } from "../../nutrition/api";
import type { Snapshot } from "../contracts";

export const pomme: ReferenceFood = {
  id: "11111111-1111-4111-8111-111111111111",
  nom: "Pomme",
  categorie: "fruits",
  caloriesKcalPour100g: 52,
  proteinesGPour100g: 0.3,
  glucidesGPour100g: 14,
  lipidesGPour100g: 0.2,
};

export const riz: ReferenceFood = {
  id: "22222222-2222-4222-8222-222222222222",
  nom: "Riz blanc cuit",
  categorie: "feculents",
  caloriesKcalPour100g: 130,
  proteinesGPour100g: 2.7,
  glucidesGPour100g: 28,
  lipidesGPour100g: 0.3,
};

export const PLAN_ID = "33333333-3333-4333-8333-333333333333";

export function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    curseur: "curseur-1",
    genereLe: "2026-10-06T10:00:00.000Z",
    suiviPoids: {
      statut: "dans-les-clous",
      plan: {
        id: PLAN_ID,
        poidsDepart: 80,
        poidsCible: 75,
        dateDebut: "2026-09-01T00:00:00.000Z",
        dateCible: "2026-12-31T00:00:00.000Z",
        imcCible: 24,
        niveauActivite: "actif",
        budgetCalorique: 1800,
        budgetPlafonneAuBmr: false,
        statut: "actif",
      },
      derniereMesure: {
        id: "m-1",
        userId: "u-1",
        planId: PLAN_ID,
        poidsKg: 79.5,
        receivedAt: "2026-10-06T06:00:00.000Z",
        jourUtc: "2026-10-06",
        source: "automatique",
        statut: "valide",
      },
      poidsAttendu: 79.6,
      ecartKg: -0.1,
    },
    mesures: [
      {
        id: "m-1",
        userId: "u-1",
        planId: PLAN_ID,
        poidsKg: 79.5,
        receivedAt: "2026-10-06T06:00:00.000Z",
        jourUtc: "2026-10-06",
        source: "automatique",
        statut: "valide",
      },
      {
        id: "m-0",
        userId: "u-1",
        planId: PLAN_ID,
        poidsKg: 79.8,
        receivedAt: "2026-10-05T06:00:00.000Z",
        jourUtc: "2026-10-05",
        source: "automatique",
        statut: "valide",
      },
    ],
    alimentation: {
      planId: PLAN_ID,
      budgetCalorique: 1800,
      ciblesMacros: { proteinesG: 150, glucidesG: 180, lipidesG: 50 },
      journaux: [
        {
          planId: PLAN_ID,
          jourUtc: "2026-10-06",
          budgetCalorique: 1800,
          entrees: [
            {
              id: "e-1",
              foodId: riz.id,
              nom: riz.nom,
              quantiteGrammes: 200,
              caloriesKcal: 260,
              proteinesG: 5.4,
              glucidesG: 56,
              lipidesG: 0.6,
              categorieRepas: "dejeuner",
              receivedAt: "2026-10-06T09:00:00.000Z",
            },
          ],
          totalCaloriesKcal: 260,
          totalProteinesG: 5.4,
          totalGlucidesG: 56,
          totalLipidesG: 0.6,
        },
      ],
    },
    favoris: [riz],
    ...overrides,
  };
}
