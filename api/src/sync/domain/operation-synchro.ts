import type { MealCategory } from '../../nutrition/domain/entities/food-entry.entity';

/**
 * Modification faite sur l'appareil (souvent hors ligne), mise en file
 * d'attente locale puis rejouée par le serveur. Chaque opération porte un
 * identifiant client ; les identifiants métier (entreeId, mesureId) sont
 * eux aussi générés par l'appareil pour que le rejeu soit idempotent.
 */
export type OperationSynchro =
  | {
      id: string;
      type: 'ajout-aliment';
      entreeId: string;
      foodId: string;
      quantiteGrammes: number;
      categorieRepas?: MealCategory;
      consommeLe: Date;
    }
  | { id: string; type: 'retrait-aliment'; entreeId: string }
  | {
      id: string;
      type: 'saisie-poids';
      mesureId: string;
      poidsKg: number;
      saisiLe: Date;
    }
  | { id: string; type: 'favori'; foodId: string; favori: boolean };

export type TypeOperation = OperationSynchro['type'];

/**
 * - appliquee : la modification est enregistrée ;
 * - deja-appliquee : rejeu d'une opération déjà traitée (réseau coupé avant
 *   la réponse), sans effet ;
 * - rejetee : refus métier définitif, l'appareil retire l'opération et
 *   prévient l'utilisateur ;
 * - a-reessayer : incident transitoire, l'opération reste en file.
 */
export type StatutOperation =
  'appliquee' | 'deja-appliquee' | 'rejetee' | 'a-reessayer';

export interface ResultatOperation {
  id: string;
  statut: StatutOperation;
  code?: string;
  message?: string;
}

export const MAX_OPERATIONS_PAR_LOT = 100;
