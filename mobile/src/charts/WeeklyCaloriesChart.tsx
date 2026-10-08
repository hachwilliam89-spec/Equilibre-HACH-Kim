import { Text, View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import type { JourCalorique } from "../coaching/api";
import { formatNutrition } from "../nutrition/presentation";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import { CHART_COLORS } from "./colors";

const TOLERANCE_KCAL = 150;
const FRAME = { width: 320, height: 170, left: 8, right: 312, top: 14, bottom: 140 };
const JOURS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Calories des derniers jours face au budget : barre verte dans la tolérance,
 * orange au-delà, contour pointillé pour un jour sans saisie. La bande claire
 * marque la zone budget ± 150 kcal.
 */
export function WeeklyCaloriesChart({ jours, budget }: { jours: JourCalorique[]; budget: number }) {
  const max = Math.max(budget + TOLERANCE_KCAL, ...jours.map((j) => j.totalCaloriesKcal)) * 1.1;
  const y = (kcal: number) => FRAME.bottom - (kcal / max) * (FRAME.bottom - FRAME.top);
  const slot = (FRAME.right - FRAME.left) / jours.length;
  const barWidth = Math.min(28, slot * 0.56);
  const renseignes = jours.filter((j) => j.statut !== "aucune-entree");
  const moyenne = renseignes.length
    ? renseignes.reduce((sum, j) => sum + j.totalCaloriesKcal, 0) / renseignes.length
    : null;
  const depassements = jours.filter((j) => j.statut === "depassement").length;

  return (
    <View style={{ gap: 10 }}>
      <View style={s.metricsRow}>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Moy. kcal</Text>
          <Text style={[s.metricValue, { fontSize: 17 }]}>
            {moyenne === null ? "—" : formatNutrition(Math.round(moyenne))}
          </Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Saisis</Text>
          <Text style={[s.metricValue, { fontSize: 17 }]}>{renseignes.length} / {jours.length}</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Dépassés</Text>
          <Text style={[s.metricValue, { fontSize: 17, color: depassements ? colors.warning : colors.ink }]}>{depassements}</Text>
        </View>
      </View>
      <View
        accessible
        accessibilityLabel={`Calories des ${jours.length} derniers jours. Budget ${formatNutrition(budget)} kilocalories. ${jours
          .map((j) => (j.statut === "aucune-entree" ? `${j.jourUtc} : aucune saisie` : `${j.jourUtc} : ${formatNutrition(j.totalCaloriesKcal)} kilocalories`))
          .join(". ")}`}
      >
        <Svg width="100%" height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
          <Rect
            x={FRAME.left}
            y={y(budget + TOLERANCE_KCAL)}
            width={FRAME.right - FRAME.left}
            height={Math.max(0, y(Math.max(0, budget - TOLERANCE_KCAL)) - y(budget + TOLERANCE_KCAL))}
            fill={CHART_COLORS.nutritionTargetZone}
            opacity={0.7}
          />
          <Line x1={FRAME.left} x2={FRAME.right} y1={y(budget)} y2={y(budget)} stroke={CHART_COLORS.target} strokeWidth={1.5} strokeDasharray="5 4" />
          <Line x1={FRAME.left} x2={FRAME.right} y1={FRAME.bottom} y2={FRAME.bottom} stroke={CHART_COLORS.axis} strokeWidth={1} />
          {jours.map((jour, index) => {
            const cx = FRAME.left + slot * index + slot / 2;
            const vide = jour.statut === "aucune-entree";
            const top = vide ? FRAME.bottom - 10 : y(jour.totalCaloriesKcal);
            const weekday = new Date(`${jour.jourUtc}T00:00:00Z`).getUTCDay();
            return (
              <G key={jour.jourUtc}>
                <Rect
                  x={cx - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={Math.max(2, FRAME.bottom - top)}
                  rx={6}
                  fill={vide ? "none" : jour.statut === "depassement" ? CHART_COLORS.warning : colors.brand}
                  stroke={vide ? CHART_COLORS.axis : "none"}
                  strokeDasharray={vide ? "3 3" : undefined}
                />
                <SvgText x={cx} y={FRAME.bottom + 18} fontSize={12} fontWeight="700" fill={index === jours.length - 1 ? colors.ink : colors.muted} textAnchor="middle">
                  {JOURS[weekday]}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
      <Text style={s.historyMeta}>
        Pointillé : budget {formatNutrition(budget)} kcal · bande : ± {TOLERANCE_KCAL} kcal · orange : dépassement · contour : aucune saisie
      </Text>
    </View>
  );
}
