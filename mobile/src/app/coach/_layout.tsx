import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text } from "react-native";
import { renderLogoutButton } from "../../auth/LogoutButton";
import { useSession } from "../../auth/session";
import { Button, Screen } from "../../plans/ui";
import { AccountActionContext } from "../../ui/accountAction";
export default function CoachLayout() {
  const { ready, session, restore, error, busy } = useSession();
  useEffect(() => { if (!ready) void restore(); }, [ready, restore]);
  if (!ready) return <Screen brand>{busy ? <ActivityIndicator /> : <><Text>{error}</Text><Button title="Réessayer" onPress={() => void restore()} /></>}</Screen>;
  if (session?.role !== "coach") return <Redirect href="/" />;
  return (
    <AccountActionContext.Provider value={renderLogoutButton}>
      <Stack screenOptions={{ headerShown: false }} />
    </AccountActionContext.Provider>
  );
}
