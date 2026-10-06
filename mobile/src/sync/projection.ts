import type { ReferenceFood } from "../nutrition/api";
import type {
  FoodBudgetState,
  LocalFoodEntry,
  LocalJournal,
  LocalMeasurement,
  LocalOperation,
  LocalView,
  ServerState,
} from "./contracts";

/**
 * La vue affichée = dernier état serveur + modifications encore en file.
 * Les opérations en attente ne sont jamais écrites dans les tables issues du
 * serveur : elles sont superposées à la lecture. Un nouvel instantané
 * remplace donc l'état serveur sans rien perdre de ce qui reste à envoyer.
 */

const JOUR_MS = 86_400_000;
export const TOLERANCE_KCAL = 150;
export const MAX_RECENTS = 8;

export const arrondirCentiemes = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const jourUtc = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** Même calcul que le serveur (FoodEntry.create) pour l'affichage provisoire. */
export function entreeProvisoire(
  operation: Extract<LocalOperation, { type: "ajout-aliment" }>,
): LocalFoodEntry {
  const coefficient = operation.quantiteGrammes / 100;
  const { aliment } = operation;
  return {
    id: operation.entreeId,
    foodId: operation.foodId,
    nom: aliment.nom,
    quantiteGrammes: operation.quantiteGrammes,
    caloriesKcal: arrondirCentiemes(aliment.caloriesKcalPour100g * coefficient),
    proteinesG: arrondirCentiemes(aliment.proteinesGPour100g * coefficient),
    glucidesG: arrondirCentiemes(aliment.glucidesGPour100g * coefficient),
    lipidesG: arrondirCentiemes(aliment.lipidesGPour100g * coefficient),
    categorieRepas: operation.categorieRepas ?? "non-classe",
    receivedAt: operation.consommeLe,
    enAttente: true,
  };
}

function avecTotaux(journal: Omit<LocalJournal, `total${string}`>): LocalJournal {
  const somme = (champ: "caloriesKcal" | "proteinesG" | "glucidesG" | "lipidesG") =>
    arrondirCentiemes(journal.entrees.reduce((total, e) => total + e[champ], 0));
  return {
    ...journal,
    totalCaloriesKcal: somme("caloriesKcal"),
    totalProteinesG: somme("proteinesG"),
    totalGlucidesG: somme("glucidesG"),
    totalLipidesG: somme("lipidesG"),
  };
}

/**
 * Règle serveur (determinerStatutBudget) reprise à l'identique : seul le
 * dernier journal non vide d'aujourd'hui ou d'hier compte ; dépassement
 * au-delà de 150 kcal au-dessus du budget.
 */
export function statutBudget(
  budgetCalorique: number,
  journaux: LocalJournal[],
  aujourdhuiUtc: string,
): FoodBudgetState {
  const dernier = journaux
    .filter((journal) => journal.entrees.length > 0)
    .sort((a, b) => b.jourUtc.localeCompare(a.jourUtc))[0];
  if (!dernier) {
    return { statut: "pas-de-donnees-recentes", ecartKcal: null, journal: null };
  }
  const anciennete =
    (Date.parse(`${aujourdhuiUtc}T00:00:00Z`) -
      Date.parse(`${dernier.jourUtc}T00:00:00Z`)) /
    JOUR_MS;
  if (anciennete < 0 || anciennete > 1) {
    return { statut: "pas-de-donnees-recentes", ecartKcal: null, journal: null };
  }
  const ecartKcal = arrondirCentiemes(dernier.totalCaloriesKcal - budgetCalorique);
  return {
    statut: ecartKcal > TOLERANCE_KCAL ? "depassement" : "dans-le-budget",
    ecartKcal,
    journal: dernier,
  };
}

function appliquerFavoris(
  favoris: ReferenceFood[],
  operations: LocalOperation[],
): ReferenceFood[] {
  const parId = new Map(favoris.map((food) => [food.id, food]));
  for (const operation of operations) {
    if (operation.type !== "favori") continue;
    if (operation.favori) parId.set(operation.foodId, operation.aliment);
    else parId.delete(operation.foodId);
  }
  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export function projeter(
  serveur: ServerState,
  operations: LocalOperation[],
  maintenant = new Date(),
  initialise = true,
): LocalView {
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const retirees = new Set(
    operations
      .filter((op) => op.type === "retrait-aliment")
      .map((op) => op.entreeId),
  );

  // Mesures : historique serveur + saisies manuelles en attente.
  const mesuresEnAttente: LocalMeasurement[] = operations
    .filter((op) => op.type === "saisie-poids")
    .filter((op) => !serveur.mesures.some((m) => m.id === op.mesureId))
    .map((op) => ({
      id: op.mesureId,
      userId: "",
      planId: serveur.suiviPoids?.plan.id ?? "",
      poidsKg: op.poidsKg,
      receivedAt: op.saisiLe,
      jourUtc: jourUtc(op.saisiLe),
      source: "manuelle",
      // Statut définitif attribué par le serveur à la synchronisation.
      statut: "valide",
      enAttente: true,
    }));
  const mesures = [
    ...mesuresEnAttente,
    ...serveur.mesures.map((m) => ({ ...m, enAttente: false })),
  ].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  let alimentation: LocalView["alimentation"] = null;
  if (serveur.alimentation) {
    const { planId, budgetCalorique, ciblesMacros } = serveur.alimentation;
    const parJour = new Map<string, LocalFoodEntry[]>();
    for (const journal of serveur.alimentation.journaux) {
      parJour.set(
        journal.jourUtc,
        journal.entrees
          .filter((entry) => !retirees.has(entry.id))
          .map((entry) => ({ ...entry, enAttente: false })),
      );
    }
    for (const operation of operations) {
      if (operation.type !== "ajout-aliment" || retirees.has(operation.entreeId)) {
        continue;
      }
      const jour = jourUtc(operation.consommeLe);
      const entrees = parJour.get(jour) ?? [];
      if (!entrees.some((entry) => entry.id === operation.entreeId)) {
        entrees.push(entreeProvisoire(operation));
      }
      parJour.set(jour, entrees);
    }
    const journaux = [...parJour.entries()]
      .map(([jour, entrees]) =>
        avecTotaux({ planId, jourUtc: jour, budgetCalorique, entrees }),
      )
      .sort((a, b) => b.jourUtc.localeCompare(a.jourUtc));
    alimentation = {
      planId,
      budgetCalorique,
      ciblesMacros,
      journaux,
      statut: statutBudget(budgetCalorique, journaux, aujourdhui),
    };
  }

  return {
    initialise,
    synchroniseLe: serveur.synchroniseLe,
    suiviPoids: serveur.suiviPoids,
    mesures,
    alimentation,
    favoris: appliquerFavoris(serveur.favoris, operations),
    recents: [...serveur.recents]
      .sort((a, b) => b.utiliseLe.localeCompare(a.utiliseLe))
      .slice(0, MAX_RECENTS)
      .map(({ utiliseLe: _utiliseLe, ...food }) => food),
    operationsEnAttente: operations.length,
  };
}
