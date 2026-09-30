import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useSession } from "../../auth/session";
import { Button, Screen } from "../../plans/ui";

export default function UserLayout() {
  const { ready, session, restore, error, busy } = useSession();

  useEffect(() => {
    if (!ready) void restore();
  }, [ready, restore]);

  if (!ready) {
    return (
      <Screen>
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
