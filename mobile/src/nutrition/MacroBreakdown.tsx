import { View, Text } from "react-native";
import { formatNutrition } from "./presentation";

type MacroKey = "proteines" | "glucides" | "lipides";

const MACROS: {
  key: MacroKey;
  label: string;
  short: string;
  color: string;
  track: string;
  kcalParGramme: number;
}[] = [
  { key: "proteines", label: "Protéines", short: "Prot.", color: "#c0564a", track: "#f6e3e0", kcalParGramme: 4 },
  { key: "glucides", label: "Glucides", short: "Gluc.", color: "#c2881c", track: "#f6ecd5", kcalParGramme: 4 },
  { key: "lipides", label: "Lipides", short: "Lip.", color: "#3f73b0", track: "#e2ebf5", kcalParGramme: 9 },
];

/**
 * Affichage lisible des macronutriments : une barre de proportion (part des
 * calories apportées par chaque macro) puis un libellé complet, couleur
 * dédiée, grammes et pourcentage. Variante compacte pour les lignes denses.
 */
export function MacroBreakdown({
  proteines,
  glucides,
  lipides,
  variant = "full",
}: {
  proteines: number;
  glucides: number;
  lipides: number;
  variant?: "full" | "compact";
}) {
  const values: Record<MacroKey, number> = { proteines, glucides, lipides };
  const energy = MACROS.map((m) => Math.max(0, values[m.key]) * m.kcalParGramme);
  const totalEnergy = energy.reduce((sum, value) => sum + value, 0);
  const percent = (index: number) =>
    totalEnergy > 0 ? Math.round((energy[index] / totalEnergy) * 100) : 0;

  if (variant === "compact") {
    return (
      <View
        accessibilityLabel={MACROS.map(
          (m) => `${m.label} ${formatNutrition(values[m.key])} grammes`,
        ).join(", ")}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}
      >
        {MACROS.map((m) => (
          <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: m.color }} />
            <Text style={{ fontSize: 13, color: "#536861" }}>
              {m.short} <Text style={{ fontWeight: "700", color: "#173b33" }}>{formatNutrition(values[m.key])} g</Text>
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={MACROS.map(
        (m, i) => `${m.label} ${formatNutrition(values[m.key])} grammes, ${percent(i)} %`,
      ).join(", ")}
      style={{ gap: 10 }}
    >
      <View
        style={{
          flexDirection: "row",
          height: 12,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: "#eef1f0",
        }}
      >
        {MACROS.map((m, i) =>
          energy[i] > 0 ? (
            <View key={m.key} style={{ flex: energy[i], backgroundColor: m.color }} />
          ) : null,
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {MACROS.map((m, i) => (
          <View key={m.key} style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: m.color }} />
              <Text style={{ fontSize: 13, color: "#536861" }}>{m.label}</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#173b33" }}>
              {formatNutrition(values[m.key])} g
            </Text>
            <Text style={{ fontSize: 12, color: "#7a8a84" }}>{percent(i)} % des macros</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
