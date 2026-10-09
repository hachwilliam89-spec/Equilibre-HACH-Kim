import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "./icons";
import { styles as s } from "./styles";
import { colors } from "./theme";

/** Carte repliable : garde l'écran court, le détail reste à un appui. */
export function Collapsible({
  title,
  hint,
  initiallyOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => setOpen((value) => !value)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.cardTitle}>{title}</Text>
          {!!hint && !open && <Text style={s.historyMeta}>{hint}</Text>}
        </View>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown color={colors.brand} />
        </View>
      </Pressable>
      {open && children}
    </View>
  );
}
