import { Text, View } from "react-native";
import {
  CALORIE_TOLERANCE_KCAL,
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
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.metricValue}>
        {formatNutrition(total)} / {formatNutrition(budget)} kcal
      </Text>
      <View
        accessible
        accessibilityLabel={`${formatNutrition(total)} kilocalories consignées aujourd’hui. Cible ${formatNutrition(budget)} kilocalories, tolérance de ${CALORIE_TOLERANCE_KCAL} kilocalories. ${display.note}`}
        style={{ height: 24, justifyContent: "center" }}
      >
        <View
          style={{
            height: 14,
            borderRadius: 7,
            backgroundColor: CHART_COLORS.grid,
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${display.consumedPercent}%`,
              borderRadius: 7,
              backgroundColor: display.overTolerance ? CHART_COLORS.warning : CHART_COLORS.nutrition,
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
        Bleu : calories consommées · trait gris : cible · tolérance : +{CALORIE_TOLERANCE_KCAL} kcal
      </Text>
      <Text style={display.overTolerance ? { color: CHART_COLORS.warning, fontWeight: "600" } : s.historyMeta}>
        {display.note}
      </Text>
    </View>
  );
}
