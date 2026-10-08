import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, AppState, Text } from "react-native";
import { useSession } from "../../auth/session";
import { Button, Screen } from "../../plans/ui";
import { useSync } from "../../sync/useSync";

/** Synchronisation de fond tant que l'app est au premier plan. */
const INTERVALLE_SYNCHRO_MS = 2 * 60 * 1000;

export default function UserLayout() {
  const { ready, session, restore, error, busy } = useSession();
  const userId = session?.role === "utilisateur" ? session.userId : null;

  useEffect(() => {
    if (!ready) void restore();
  }, [ready, restore]);

  useEffect(() => {
    if (!userId) return;
    const sync = useSync.getState();
    void sync.demarrer(userId);
    // Retour au premier plan : souvent le moment où le réseau revient.
    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") void useSync.getState().synchroniser();
    });
    const minuterie = setInterval(() => {
      if (AppState.currentState === "active") void useSync.getState().synchroniser();
    }, INTERVALLE_SYNCHRO_MS);
    return () => {
      abonnement.remove();
      clearInterval(minuterie);
    };
  }, [userId]);

  if (!ready) {
    return (
      <Screen brand>
        {busy ? (
          <ActivityIndicator accessibilityLabel="Restauration de la session" />
        ) : (
          <>
            <Text accessibilityRole="alert">{error}</Text>
            <Button title="Réessayer" onPress={() => void restore()} />
          </>
        )}
      </Screen>
    );
  }

  if (session?.role !== "utilisateur") return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
