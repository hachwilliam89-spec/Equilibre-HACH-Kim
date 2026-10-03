import { Text, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import type { Measurement } from "../measurements/api";
import { formatUtcDay, formatWeight } from "../measurements/presentation";
import { styles as s } from "../ui/styles";
import { CHART_COLORS } from "./colors";
import {
  chartCoordinates,
  validWeightPoints,
  WEIGHT_CHART_FRAME,
  type WeightPlan,
} from "./weight-series";

export function WeightTrajectoryChart({
  plan,
  measurements,
}: {
  plan: WeightPlan;
  measurements: Measurement[];
}) {
  const points = validWeightPoints(plan, measurements);
  const { ticks, target, actual, segments } = chartCoordinates(plan, points);
  const last = points.at(-1);
  const frame = WEIGHT_CHART_FRAME;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.cardTitle}>Poids réel et trajectoire cible</Text>
      <View
        accessible
        accessibilityLabel={`Graphique du poids du ${formatUtcDay(plan.dateDebut)} au ${formatUtcDay(plan.dateCible)}. Trajectoire cible de ${formatWeight(plan.poidsDepart)} à ${formatWeight(plan.poidsCible)}. ${points.length} mesure${points.length > 1 ? "s" : ""} valide${points.length > 1 ? "s" : ""}. ${last ? `Dernière mesure : ${formatWeight(last.weightKg)} le ${formatUtcDay(last.dayUtc)}.` : "Aucune mesure valide."}`}
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
        <Text style={s.historyMeta}>{formatUtcDay(plan.dateDebut)}</Text>
        <Text style={s.historyMeta}>{formatUtcDay(plan.dateCible)}</Text>
      </View>
      <Text style={s.historyMeta}>
        Vert et points : pesées valides · gris pointillé : objectif · vert pointillé : jours sans pesée
      </Text>
      {last && (
        <Text style={s.label}>
          Dernière pesée valide : {formatWeight(last.weightKg)} le {formatUtcDay(last.dayUtc)}
        </Text>
      )}
      {points.length === 0 && <Text style={s.text}>Aucune mesure valide pour ce plan.</Text>}
    </View>
  );
}
