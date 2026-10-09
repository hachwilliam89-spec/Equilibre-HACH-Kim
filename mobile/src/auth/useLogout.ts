import { useState } from "react";
import { useSync } from "../sync/useSync";
import { useSession } from "./session";

/** Message de confirmation selon les modifications encore sur l'appareil. */
export function logoutMessage(pending: number): string {
  if (pending === 0) return "Vous devrez saisir à nouveau vos identifiants.";
  return pending === 1
    ? "1 modification n’a pas encore été envoyée et sera perdue. Reconnectez-vous au réseau pour la synchroniser, ou déconnectez-vous quand même."
    : `${pending} modifications n’ont pas encore été envoyées et seront perdues. Reconnectez-vous au réseau pour les synchroniser, ou déconnectez-vous quand même.`;
}

/**
 * Déconnexion en deux temps : `prepare` tente un dernier envoi et renvoie
 * le nombre de modifications encore en attente (pour la confirmation),
 * `leave` ferme la session puis efface la base embarquée.
 */
export function useLogout() {
  const { session, busy, error, signOut } = useSession();
  const [preparing, setPreparing] = useState(false);

  const prepare = async (): Promise<number> => {
    if (session?.role !== "utilisateur") return 0;
    setPreparing(true);
    try {
      await useSync.getState().synchroniser();
      return useSync.getState().vue.operationsEnAttente;
    } finally {
      setPreparing(false);
    }
  };

  const leave = async () => {
    await signOut();
    if (!useSession.getState().session) await useSync.getState().reinitialiser();
  };

  return { prepare, leave, busy: busy || preparing, error };
}
