import type { OperationResult, QueuedOperation } from "./contracts";
import type { SyncApi } from "./api";
import type { LocalStore } from "./local-store";

export const TAILLE_LOT = 100;
/** Au-delà, une opération en échec transitoire est abandonnée. */
export const MAX_TENTATIVES = 5;

export type Rejet = {
  operation: QueuedOperation;
  code?: string;
  message: string;
};

export type RapportSynchro = {
  envoyees: number;
  rejets: Rejet[];
  /** false : pull 204, la copie locale était déjà à jour. */
  donneesRecues: boolean;
};

/**
 * Un cycle de synchronisation :
 * 1. push : les modifications en file partent par lots, dans l'ordre de
 *    saisie ; le serveur répond opération par opération et renvoie son
 *    instantané à jour (un seul aller-retour) ;
 * 2. pull : sans rien à envoyer, on demande l'instantané avec le dernier
 *    curseur ; 204 si rien n'a changé.
 * Le serveur fait autorité : ce qu'il refuse est retiré de la file et
 * signalé, ce qu'il accepte réapparaît dans l'instantané.
 * Toute erreur réseau remonte telle quelle : la file reste intacte.
 */
export async function synchroniser(
  store: LocalStore,
  api: SyncApi,
  maintenant: () => Date = () => new Date(),
): Promise<RapportSynchro> {
  const rapport: RapportSynchro = { envoyees: 0, rejets: [], donneesRecues: false };
  let file = await store.operations();

  while (file.length > 0) {
    const lot = file.slice(0, TAILLE_LOT);
    const { resultats, instantane } = await api.push(lot);
    const parId = new Map<string, OperationResult>(resultats.map((r) => [r.id, r]));
    const terminees: string[] = [];
    const aReessayer: string[] = [];

    for (const operation of lot) {
      const resultat = parId.get(operation.id);
      if (!resultat || resultat.statut === "a-reessayer") {
        if (operation.tentatives + 1 >= MAX_TENTATIVES) {
          terminees.push(operation.id);
          rapport.rejets.push({
            operation,
            code: resultat?.code ?? "abandon",
            message: "Modification abandonnée après plusieurs tentatives.",
          });
        } else {
          aReessayer.push(operation.id);
        }
        continue;
      }
      terminees.push(operation.id);
      if (resultat.statut === "rejetee") {
        rapport.rejets.push({
          operation,
          code: resultat.code,
          message: resultat.message ?? "Modification refusée par le serveur.",
        });
      } else {
        rapport.envoyees += 1;
      }
    }

    await store.retirerOperations(terminees);
    await store.noterTentative(aReessayer);
    await store.remplacerEtatServeur(instantane, maintenant().toISOString());
    rapport.donneesRecues = true;

    // Les opérations à réessayer attendront le prochain cycle.
    if (aReessayer.length > 0) return rapport;
    file = await store.operations();
  }

  if (!rapport.donneesRecues) {
    const { curseur } = await store.lireEtatServeur();
    const instantane = await api.pull(curseur);
    if (instantane) {
      await store.remplacerEtatServeur(instantane, maintenant().toISOString());
      rapport.donneesRecues = true;
    } else {
      await store.marquerSynchronise(maintenant().toISOString());
    }
  }
  return rapport;
}
