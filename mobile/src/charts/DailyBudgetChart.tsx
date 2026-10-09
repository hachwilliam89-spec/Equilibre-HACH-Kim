import { Text, View } from "react-native";
import { dailyBudgetPresentation, formatKcal } from "../nutrition/presentation";
import { styles as s } from "../ui/styles";
import { CHART_COLORS } from "./colors";

export function DailyBudgetChart({
  total,
  budget,
  hasEntries,
  showTotal = true,
}: {
  total: number;
  budget: number;
  hasEntries: boolean;
  /** Afficher seulement le budget quand l'écran montre déjà les calories consommées. */
  showTotal?: boolean;
}) {
  const display = dailyBudgetPresentation(total, budget, hasEntries);
  const progressColor = display.phase === "target"
    ? CHART_COLORS.measured
    : display.phase === "over"
      ? CHART_COLORS.warning
      : CHART_COLORS.nutrition;
  return (
    <View style={{ gap: 10 }}>
      {showTotal ? (
        <Text style={s.metricValue}>
          {formatKcal(total)} / {formatKcal(budget)} kcal
        </Text>
      ) : (
        <Text style={s.historyMeta}>
          Budget du jour : {formatKcal(budget)} kcal
        </Text>
      )}
      <View
        accessible
        accessibilityLabel={`${formatKcal(total)} kilocalories consignées aujourd’hui. Zone cible de ${formatKcal(display.zoneStart)} à ${formatKcal(display.zoneEnd)} kilocalories. ${display.note}`}
        style={{ height: 24, justifyContent: "center" }}
      >
        <View
          style={{
            height: 14,
            borderRadius: 7,
            backgroundColor: CHART_COLORS.grid,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: `${display.zoneStartPercent}%`,
              width: `${display.zoneEndPercent - display.zoneStartPercent}%`,
              height: "100%",
              backgroundColor: CHART_COLORS.nutritionTargetZone,
            }}
          />
          <View
            style={{
              height: "100%",
              width: `${display.consumedPercent}%`,
              borderRadius: 7,
              backgroundColor: progressColor,
            }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            left: `${display.targetPercent}%`,
            top: 1,
            height: 22,
            borderLeftWidth: 2,
            borderLeftColor: CHART_COLORS.target,
          }}
        />
      </View>
      <Text style={s.historyMeta}>
        Objectif {formatKcal(budget)} kcal (trait) · zone verte : ± 150 kcal
      </Text>
      <Text style={display.phase === "target"
        ? { color: CHART_COLORS.measured, fontWeight: "600" }
        : display.overTolerance
          ? { color: CHART_COLORS.warning, fontWeight: "600" }
          : s.historyMeta}>
        {display.note}
      </Text>
    </View>
  );
}
