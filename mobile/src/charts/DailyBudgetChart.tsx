import { Text, View } from "react-native";
import {
  dailyBudgetPresentation,
  formatNutrition,
} from "../nutrition/presentation";
import { styles as s } from "../ui/styles";
import { CHART_COLORS } from "./colors";

export function DailyBudgetChart({
  total,
  budget,
  hasEntries,
}: {
  total: number;
  budget: number;
  hasEntries: boolean;
}) {
  const display = dailyBudgetPresentation(total, budget, hasEntries);
  const progressColor = display.phase === "target"
    ? CHART_COLORS.measured
    : display.phase === "over"
      ? CHART_COLORS.warning
      : CHART_COLORS.nutrition;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.metricValue}>
        {formatNutrition(total)} / {formatNutrition(budget)} kcal
      </Text>
      <View
        accessible
        accessibilityLabel={`${formatNutrition(total)} kilocalories consignées aujourd’hui. Zone cible de ${formatNutrition(display.zoneStart)} à ${formatNutrition(display.zoneEnd)} kilocalories. ${display.note}`}
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
        Zone visée : {formatNutrition(display.zoneStart)}–{formatNutrition(display.zoneEnd)} kcal · trait : {formatNutrition(budget)} kcal
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
