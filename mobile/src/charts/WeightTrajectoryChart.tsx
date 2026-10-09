import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import type { Measurement } from "../measurements/api";
import { formatUtcDay, formatWeight } from "../measurements/presentation";
import { styles as s } from "../ui/styles";
import { CHART_COLORS } from "./colors";
import {
  chartCoordinates,
  validWeightPoints,
  WEIGHT_CHART_FRAME,
  weightChartWindow,
  type WeightChartRange,
  type WeightPlan,
} from "./weight-series";

const ranges: { value: WeightChartRange; label: string }[] = [
  { value: 7, label: "7 j" },
  { value: 30, label: "30 j" },
  { value: 90, label: "90 j" },
  { value: "plan", label: "Tout" },
];

const rangeAccessibilityLabel = (range: WeightChartRange) =>
  range === "plan" ? "Plan entier" : `${range} jours`;

export function WeightTrajectoryChart({
  plan,
  measurements,
  showLast = true,
}: {
  plan: WeightPlan;
  measurements: Measurement[];
  /** Masquer la dernière pesée quand l'écran l'affiche déjà en grand. */
  showLast?: boolean;
}) {
  const [range, setRange] = useState<WeightChartRange>(7);
  const points = validWeightPoints(plan, measurements);
  const window = weightChartWindow(plan, range, new Date().toISOString().slice(0, 10));
  const { ticks, target, actual, segments, visiblePoints } = chartCoordinates(
    plan,
    points,
    window,
  );
  const last = visiblePoints.at(-1);
  const frame = WEIGHT_CHART_FRAME;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.cardTitle}>Poids réel et trajectoire cible</Text>
      <Text style={s.metricLabel}>Période</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {ranges.map(({ value, label }) => {
          const selected = range === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={rangeAccessibilityLabel(value)}
              accessibilityState={{ checked: selected }}
              onPress={() => setRange(value)}
              style={[
                s.choice,
                { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
                selected && s.choiceSelected,
              ]}
            >
              <Text style={[s.label, { fontSize: 13, color: selected ? CHART_COLORS.measured : CHART_COLORS.target }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View
        accessible
        accessibilityLabel={`Graphique du poids du ${formatUtcDay(window.startUtc)} au ${formatUtcDay(window.endUtc)}. ${visiblePoints.length} mesure${visiblePoints.length > 1 ? "s" : ""} valide${visiblePoints.length > 1 ? "s" : ""} sur cette période. ${last ? `Dernière mesure : ${formatWeight(last.weightKg)} le ${formatUtcDay(last.dayUtc)}.` : "Aucune mesure valide sur cette période."}`}
        style={{ width: "100%", aspectRatio: frame.width / frame.height }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${frame.width} ${frame.height}`}>
          {ticks.map(({ weightKg, y }) => (
            <SvgText
              key={weightKg}
              x={frame.left - 8}
              y={y + 4}
              textAnchor="end"
              fill={CHART_COLORS.target}
              fontSize={14}
            >
              {`${Number(weightKg.toFixed(1)).toString().replace(".", ",")}`}
            </SvgText>
          ))}
          {ticks.map(({ weightKg, y }) => (
            <Line
              key={`grid-${weightKg}`}
              x1={frame.left}
              y1={y}
              x2={frame.right}
              y2={y}
              stroke={CHART_COLORS.grid}
            />
          ))}
          <Line
            x1={frame.left}
            y1={frame.top}
            x2={frame.left}
            y2={frame.bottom}
            stroke={CHART_COLORS.axis}
          />
          <Line
            x1={target[0].x}
            y1={target[0].y}
            x2={target[1].x}
            y2={target[1].y}
            stroke={CHART_COLORS.target}
            strokeWidth={2}
            strokeDasharray="6 5"
          />
          {segments.map(({ from, to, hasGap }, index) => (
            <Line
              key={actual[index + 1].dayUtc}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={CHART_COLORS.measured}
              strokeWidth={2.5}
              strokeDasharray={hasGap ? "4 4" : undefined}
            />
          ))}
          {actual.map(({ dayUtc, x, y }) => (
            <Circle key={dayUtc} cx={x} cy={y} r={4} fill={CHART_COLORS.measured} />
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.historyMeta}>{formatUtcDay(window.startUtc)}</Text>
        <Text style={s.historyMeta}>{formatUtcDay(window.endUtc)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 15, height: 3, borderRadius: 2, backgroundColor: CHART_COLORS.measured }} />
          <Text style={s.historyMeta}>Pesées</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 15, borderTopWidth: 2, borderStyle: "dashed", borderColor: CHART_COLORS.target }} />
          <Text style={s.historyMeta}>Objectif</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 15, borderTopWidth: 2, borderStyle: "dashed", borderColor: CHART_COLORS.measured }} />
          <Text style={s.historyMeta}>Jours sans pesée</Text>
        </View>
      </View>
      {showLast && last && (
        <Text style={s.label}>
          Dernière pesée valide : {formatWeight(last.weightKg)} le {formatUtcDay(last.dayUtc)}
        </Text>
      )}
      {visiblePoints.length === 0 && (
        <Text style={s.text}>Aucune pesée valide sur cette période.</Text>
      )}
    </View>
  );
}
