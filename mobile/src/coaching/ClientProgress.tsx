import { Text, View } from "react-native";
import { WeeklyCaloriesChart } from "../charts/WeeklyCaloriesChart";
import { WeightTrajectoryChart } from "../charts/WeightTrajectoryChart";
import {
  formatSignedWeight,
  formatUtcDay,
  formatWeight,
  goalProgress,
  measurementSourceLabel,
  measurementStatusLabel,
  trackingPresentation,
} from "../measurements/presentation";
import { foodStatusPresentation, formatNutrition } from "../nutrition/presentation";
import { Collapsible } from "../ui/Collapsible";
import { BowlIcon, ScaleIcon } from "../ui/icons";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import type { ClientProgression } from "./api";

function Pill({ icon, label, color, background }: { icon: React.ReactNode; label: string; color: string; background: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: background }}>
      {icon}
      <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** Progression d'un utilisateur vue par son coach : résumé, courbes, pesées. */
export function ClientProgress({ progression }: { progression: ClientProgression }) {
  const { suiviPoids, mesures, alimentation } = progression;
  if (!suiviPoids) return null;
  const weight = trackingPresentation[suiviPoids.statut];
  const food = alimentation ? foodStatusPresentation[alimentation.statut] : null;
  const derniere = suiviPoids.derniereMesure;
  const progress = derniere
    ? goalProgress(suiviPoids.plan.poidsDepart, suiviPoids.plan.poidsCible, derniere.poidsKg)
    : null;

  return (
    <>
      <View style={s.card}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Pill icon={<ScaleIcon size={15} color={weight.color} />} label={weight.label} color={weight.color} background={weight.background} />
          {food && <Pill icon={<BowlIcon size={15} color={food.color} />} label={food.label} color={food.color} background={food.background} />}
        </View>
        <View style={{ gap: 2 }}>
          <Text style={s.metricLabel}>Dernière pesée</Text>
          <Text style={{ fontSize: 34, fontWeight: "800", color: colors.ink }}>
            {derniere ? formatWeight(derniere.poidsKg) : "—"}
          </Text>
          <Text style={s.historyMeta}>
            {derniere ? `le ${formatUtcDay(derniere.jourUtc)}` : "En attente de la première pesée"}
          </Text>
        </View>
        {progress && (
          <View style={{ gap: 6 }}>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.mint, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(progress.fraction * 100, 3)}%`, height: "100%", borderRadius: 5, backgroundColor: colors.brandBright }} />
            </View>
            <View style={s.summaryRow}>
              <Text style={s.historyMeta}>{formatWeight(progress.parcouruKg)} sur {formatWeight(progress.totalKg)}</Text>
              <Text style={[s.historyMeta, { fontWeight: "700", color: colors.ink }]}>Cible {formatWeight(suiviPoids.plan.poidsCible)}</Text>
            </View>
          </View>
        )}
        <View style={s.metricsRow}>
          <View style={s.metric}>
            <Text style={s.metricLabel}>Attendu</Text>
            <Text style={[s.metricValue, { fontSize: 17 }]}>{suiviPoids.poidsAttendu !== null ? formatWeight(suiviPoids.poidsAttendu) : "—"}</Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricLabel}>Écart poids</Text>
            <Text style={[s.metricValue, { fontSize: 17, color: suiviPoids.statut === "ecart-detecte" ? colors.warning : colors.ink }]}>
              {suiviPoids.ecartKg !== null ? formatSignedWeight(suiviPoids.ecartKg) : "—"}
            </Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricLabel}>Écart kcal</Text>
            <Text style={[s.metricValue, { fontSize: 17, color: alimentation?.statut === "depassement" ? colors.warning : colors.ink }]}>
              {alimentation?.ecartKcal != null ? `${alimentation.ecartKcal > 0 ? "+" : ""}${formatNutrition(alimentation.ecartKcal)}` : "—"}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.card}>
        <WeightTrajectoryChart plan={suiviPoids.plan} measurements={mesures} />
      </View>

      {alimentation && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Alimentation · 7 derniers jours</Text>
          <WeeklyCaloriesChart jours={alimentation.jours} budget={alimentation.budgetCalorique} />
          <Text style={s.historyMeta}>Totaux journaliers uniquement : le détail des aliments reste privé.</Text>
        </View>
      )}

      {mesures.length > 0 && (
        <Collapsible title="Dernières pesées" hint={`${mesures.length} pesée${mesures.length > 1 ? "s" : ""} sur 3 mois`}>
          {mesures.slice(0, 10).map((mesure) => (
            <View key={mesure.id} style={s.historyItem}>
              <View style={s.historyMain}>
                <Text style={s.historyWeight}>{formatWeight(mesure.poidsKg)}</Text>
                <Text style={s.text}>{formatUtcDay(mesure.jourUtc)}</Text>
              </View>
              <Text style={s.historyMeta}>
                {measurementSourceLabel[mesure.source]} · {measurementStatusLabel[mesure.statut]}
              </Text>
            </View>
          ))}
        </Collapsible>
      )}
    </>
  );
}
