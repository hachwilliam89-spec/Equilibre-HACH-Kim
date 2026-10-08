import { useState } from "react";
import { useSync } from "../sync/useSync";
import { useSession } from "./session";

/**
 * Déconnexion : dernière tentative d'envoi, puis effacement de la base
 * embarquée. S'il reste des modifications non envoyées, on prévient avant
 * de les perdre (second appui pour confirmer).
 */
export function useLogout() {
  const { session, busy, error, signOut } = useSession();
  const [pendingWarning, setPendingWarning] = useState<number | null>(null);

  const leave = async () => {
    const sync = useSync.getState();
    if (session?.role === "utilisateur" && pendingWarning === null) {
      await sync.synchroniser();
      const pending = useSync.getState().vue.operationsEnAttente;
      if (pending > 0) {
        setPendingWarning(pending);
        return;
      }
    }
    await signOut();
    if (!useSession.getState().session) {
      setPendingWarning(null);
      await sync.reinitialiser();
    }
  };

  const warning =
    pendingWarning === null
      ? null
      : `${
          pendingWarning === 1
            ? "1 modification n’a pas encore été envoyée et sera perdue."
            : `${pendingWarning} modifications n’ont pas encore été envoyées et seront perdues.`
        } Reconnecte-toi au réseau pour les synchroniser, ou confirme la déconnexion.`;

  const label = busy
    ? "Déconnexion…"
    : pendingWarning !== null
      ? "Se déconnecter quand même"
      : "Se déconnecter";

  return { leave, busy, error, warning, label };
}
