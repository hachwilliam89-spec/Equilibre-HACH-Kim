import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { Measurement } from "../measurements/api";
import { formatUtcDay } from "../measurements/presentation";
import { styles as s } from "../ui/styles";
import { chartCoordinates, validWeightPoints, type WeightPlan } from "./weight-series";

export function WeightTrajectoryChart({
  plan,
  measurements,
}: {
  plan: WeightPlan;
  measurements: Measurement[];
}) {
  const points = validWeightPoints(plan, measurements);
  const { low, high, target, actual } = chartCoordinates(plan, points);
  const actualPath = actual.map(({ x, y }) => `${x},${y}`).join(" ");
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.cardTitle}>Poids réel et trajectoire cible</Text>
      <View
        accessible
        accessibilityLabel={`Graphique du poids du ${formatUtcDay(plan.dateDebut)} au ${formatUtcDay(plan.dateCible)}. Objectif de ${plan.poidsDepart} à ${plan.poidsCible} kg. ${points.length} mesure${points.length > 1 ? "s" : ""} valide${points.length > 1 ? "s" : ""} affichée${points.length > 1 ? "s" : ""}.`}
      >
        <Svg width="100%" height={180} viewBox="0 0 320 180">
          <Line x1={24} y1={30} x2={24} y2={150} stroke="#b8cbc0" />
          <Line x1={24} y1={150} x2={296} y2={150} stroke="#b8cbc0" />
          <Polyline
            points={target.map(({ x, y }) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#7b8580"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
          {actual.length > 1 && (
            <Polyline points={actualPath} fill="none" stroke="#087454" strokeWidth={3} />
          )}
          {actual.map(({ x, y }, index) => (
            <Circle key={`${points[index].dayUtc}`} cx={x} cy={y} r={4} fill="#087454" />
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.historyMeta}>{formatUtcDay(plan.dateDebut)}</Text>
        <Text style={s.historyMeta}>{low}–{high} kg</Text>
        <Text style={s.historyMeta}>{formatUtcDay(plan.dateCible)}</Text>
      </View>
      <Text style={s.historyMeta}>Vert : mesures valides · pointillé : objectif du plan</Text>
      {points.length === 0 && <Text style={s.text}>Aucune mesure valide pour ce plan.</Text>}
    </View>
  );
}
