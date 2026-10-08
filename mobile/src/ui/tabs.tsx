import type { ComponentType } from "react";
import { View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./theme";

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Icône d'onglet : pastille menthe derrière l'onglet actif. */
export function tabIcon(Icon: IconComponent) {
  function TabBarIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return (
      <View
        style={{
          width: 52,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? colors.mint : "transparent",
        }}
      >
        <Icon size={22} color={typeof color === "string" ? color : colors.brand} strokeWidth={focused ? 2.3 : 1.9} />
      </View>
    );
  }
  return TabBarIcon;
}

/** Options communes des barres d'onglets (hauteur calée sur la zone sûre). */
export function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.brand,
    tabBarInactiveTintColor: colors.subtle,
    tabBarLabelStyle: { fontSize: 12, fontWeight: "700" as const },
    tabBarStyle: {
      backgroundColor: colors.card,
      borderTopColor: colors.border,
      height: 64 + insets.bottom,
      paddingTop: 6,
      paddingBottom: Math.max(insets.bottom, 8),
    },
  };
}
