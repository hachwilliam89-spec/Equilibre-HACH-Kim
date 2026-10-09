import type { ComponentType } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./theme";

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Barre de sections fixée en bas d'un écran secondaire : même aspect que la
 * barre d'onglets principale, pour découper un écran long sans défilement.
 */
export function SectionTabBar<T extends string>({
  sections,
  value,
  onChange,
  disabled = false,
}: {
  sections: { value: T; label: string; icon: IconComponent }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {sections.map(({ value: section, label, icon: Icon }) => {
        const selected = section === value;
        const tint = selected ? colors.brand : colors.subtle;
        return (
          <Pressable
            key={section}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(section)}
            style={{ flex: 1, alignItems: "center", gap: 2, opacity: disabled && !selected ? 0.5 : 1 }}
          >
            <View style={{ width: 52, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.mint : "transparent" }}>
              <Icon size={22} color={tint} strokeWidth={selected ? 2.3 : 1.9} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: tint }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
