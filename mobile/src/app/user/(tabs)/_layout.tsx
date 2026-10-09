import { Tabs } from "expo-router/js-tabs";
import { BowlIcon, ScaleIcon, UserIcon } from "../../../ui/icons";
import { tabIcon, useTabScreenOptions } from "../../../ui/tabs";

export default function UserTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: "Suivi", tabBarIcon: tabIcon(ScaleIcon) }} />
      <Tabs.Screen name="journal" options={{ title: "Journal", tabBarIcon: tabIcon(BowlIcon) }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: tabIcon(UserIcon) }} />
    </Tabs>
  );
}
