import type { ReferenceFood } from "../nutrition/api";
import type {
  LocalOperation,
  QueuedOperation,
  ServerState,
  Snapshot,
} from "./contracts";

/**
 * Port de la base embarquée. Deux adaptateurs :
 * - SQLite (expo-sqlite) sur iOS/Android ;
 * - mémoire pour l'aperçu web, qui ne persiste rien sur le navigateur
 *   (même choix que pour la session).
 * Les deux passent la même suite de tests de contrat.
 */
export interface LocalStore {
  /** Ouvre la base pour ce compte ; efface les données d'un autre compte. */
  ouvrir(userId: string): Promise<void>;
  lireEtatServeur(): Promise<ServerState>;
  /** Remplace intégralement la copie serveur (la file d'attente est conservée). */
  remplacerEtatServeur(snapshot: Snapshot, recuLe: string): Promise<void>;
  /** Pull sans changement (204) : seule l'heure de synchronisation avance. */
  marquerSynchronise(le: string): Promise<void>;
  operations(): Promise<QueuedOperation[]>;
  enfiler(operation: LocalOperation, creeLe: string): Promise<void>;
  retirerOperations(ids: string[]): Promise<void>;
  noterTentative(ids: string[]): Promise<void>;
  noterRecent(food: ReferenceFood, le: string): Promise<void>;
  /** Déconnexion : rien ne doit rester sur l'appareil. */
  vider(): Promise<void>;
}
