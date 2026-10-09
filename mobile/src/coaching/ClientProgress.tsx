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
} from "../measurements/presentation";
import { Collapsible } from "../ui/Collapsible";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import { coachActionLabel, coachAlerts, type ClientProgression } from "./api";

/** Progression d'un utilisateur vue par son coach : résumé, courbes, pesées. */
export function ClientProgress({ progression }: { progression: ClientProgression }) {
  const { suiviPoids, mesures, alimentation } = progression;
  if (!suiviPoids) return null;
  const derniere = suiviPoids.derniereMesure;
  const progress = derniere
    ? goalProgress(suiviPoids.plan.poidsDepart, suiviPoids.plan.poidsCible, derniere.poidsKg)
    : null;

  const alerts = coachAlerts(progression);

  return (
    <>
      <View
        accessibilityRole="summary"
        style={[s.card, alerts.length
          ? { backgroundColor: "#fff6eb", borderColor: "#f1c58e" }
          : { backgroundColor: colors.mintSoft, borderColor: colors.mint }]}
      >
        <Text style={[s.metricLabel, { color: alerts.length ? colors.warning : colors.brand }]}>
          {alerts.length ? "À faire" : "Rien à signaler"}
        </Text>
        {alerts.length ? (
          alerts.map((alert) => (
            <View key={alert.raison} style={{ gap: 2 }}>
              <Text style={[s.label, { color: colors.ink }]}>{alert.raison}</Text>
              <Text style={s.pillText}>→ {coachActionLabel[alert.action]}</Text>
            </View>
          ))
        ) : (
          <Text style={s.label}>Poids sur la trajectoire et calories dans le budget.</Text>
        )}
      </View>

      <View style={s.card}>
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
        </View>
      </View>

      <View style={s.card}>
        <WeightTrajectoryChart plan={suiviPoids.plan} measurements={mesures} showLast={false} />
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
