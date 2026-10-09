import { Tabs } from "expo-router/js-tabs";
import { KeyIcon, UsersIcon } from "../../../ui/icons";
import { tabIcon, useTabScreenOptions } from "../../../ui/tabs";

export default function CoachTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: "Utilisateurs", tabBarIcon: tabIcon(UsersIcon) }} />
      <Tabs.Screen name="account" options={{ title: "Mon compte", tabBarIcon: tabIcon(KeyIcon) }} />
    </Tabs>
  );
}
