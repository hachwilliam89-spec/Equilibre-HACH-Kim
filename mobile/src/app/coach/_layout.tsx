import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useSession } from "../../auth/session";
import { Button, Screen } from "../../plans/ui";
export default function CoachLayout() {
  const { ready, session, restore, error, busy } = useSession();
  useEffect(() => { if (!ready) void restore(); }, [ready, restore]);
  if (!ready) return <Screen>{busy ? <ActivityIndicator /> : <><Text>{error}</Text><Button title="Réessayer" onPress={() => void restore()} /></>}</Screen>;
  if (session?.role !== "coach") return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
