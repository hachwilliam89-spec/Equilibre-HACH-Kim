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
import { MacroBreakdown } from "../nutrition/MacroBreakdown";
import { foodStatusPresentation } from "../nutrition/presentation";
import { Collapsible } from "../ui/Collapsible";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import { coachActionLabel, coachAlerts, persistentAlertReason, type ClientProgression } from "./api";
import { Button } from "../plans/ui";
import { AlertIcon } from "../ui/icons";
import { moyenneSummary } from "../activity/presentation";

/** Progression d'un utilisateur vue par son coach : résumé, courbes, pesées. */
export type ClientSection = "suivi" | "alimentation";

/** Écart persistant (US5) : bandeau commun aux onglets Poids et Alimentation. */
function PersistentBanner({ raisons, onAdjust }: { raisons: string[]; onAdjust?: () => void }) {
  return (
    <View accessibilityRole="alert" style={[s.card, { backgroundColor: "#fbe9e7", borderColor: "#efb9b3" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AlertIcon color={colors.danger} size={18} />
        <Text style={[s.metricLabel, { color: colors.danger }]}>Écart persistant</Text>
      </View>
      {raisons.map((raison) => <Text key={raison} style={[s.label, { color: colors.ink }]}>{raison}</Text>)}
      <Text style={s.historyMeta}>3 valeurs consécutives hors tolérance. L’alerte disparaît au retour dans la tolérance ou après un ajustement.</Text>
      {onAdjust && <Button title="Ajuster le plan" onPress={onAdjust} />}
    </View>
  );
}

export function ClientProgress({ progression, section, onAdjust }: {
  progression: ClientProgression;
  section: ClientSection;
  /** Ouvre l'ajustement du plan actif (US5). */
  onAdjust?: () => void;
}) {
  const { suiviPoids, mesures, alimentation } = progression;
  if (!suiviPoids) return null;
  const derniere = suiviPoids.derniereMesure;
  const progress = derniere
    ? goalProgress(suiviPoids.plan.poidsDepart, suiviPoids.plan.poidsCible, derniere.poidsKg)
    : null;

  const alerts = coachAlerts(progression);
  const persistantes = progression.alertes ?? [];
  const persistanteCalories = persistantes.filter((a) => a.metrique === "calories").map(persistentAlertReason);
  // Les écarts persistants ont leur bandeau : le résumé garde les autres raisons.
  const autres = alerts.filter((alert) => alert.action !== "ajuster-plan");

  if (section === "alimentation") {
    if (!alimentation) {
      return (
        <View style={s.card}>
          <Text style={s.text}>Aucun suivi alimentaire sans plan actif.</Text>
        </View>
      );
    }
    const saisis = alimentation.jours.filter((jour) => jour.statut !== "aucune-entree");
    const moyenne = (key: "totalProteinesG" | "totalGlucidesG" | "totalLipidesG") =>
      saisis.length ? saisis.reduce((sum, jour) => sum + jour[key], 0) / saisis.length : 0;
    const food = foodStatusPresentation[alimentation.statut];
    return (
      <>
        {persistanteCalories.length > 0 && <PersistentBanner raisons={persistanteCalories} onAdjust={onAdjust} />}
        <View style={[s.card, { backgroundColor: food.background, borderColor: food.background }]}>
          <Text style={s.metricLabel}>Suivi alimentaire · 7 derniers jours</Text>
          <Text style={s.cardTitle}>
            {saisis.length} jour{saisis.length > 1 ? "s" : ""} saisi{saisis.length > 1 ? "s" : ""} sur 7
          </Text>
          <Text style={[s.historyMeta, { color: food.color }]}>
            {saisis.length > 0
              ? `Dernier jour saisi : ${food.label.toLocaleLowerCase("fr-FR")} (± 150 kcal).`
              : "Aucun repas récent à évaluer."}
          </Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Calories · 7 derniers jours</Text>
          <WeeklyCaloriesChart jours={alimentation.jours} budget={alimentation.budgetCalorique} />
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Macros · moyenne des jours saisis</Text>
          {saisis.length ? (
            <MacroBreakdown
              proteines={Math.round(moyenne("totalProteinesG"))}
              glucides={Math.round(moyenne("totalGlucidesG"))}
              lipides={Math.round(moyenne("totalLipidesG"))}
              targets={{
                proteines: alimentation.ciblesMacros.proteinesG,
                glucides: alimentation.ciblesMacros.glucidesG,
                lipides: alimentation.ciblesMacros.lipidesG,
              }}
            />
          ) : (
            <Text style={s.text}>Aucun repas saisi sur les 7 derniers jours.</Text>
          )}
          <Text style={s.historyMeta}>Totaux journaliers uniquement : le détail des aliments reste privé.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      {persistantes.length > 0 && (
        <PersistentBanner raisons={persistantes.map(persistentAlertReason)} onAdjust={onAdjust} />
      )}
      {(autres.length > 0 || persistantes.length === 0) && (
        <View
          accessibilityRole="summary"
          style={[s.card, autres.length
            ? { backgroundColor: "#fff6eb", borderColor: "#f1c58e" }
            : { backgroundColor: colors.mintSoft, borderColor: colors.mint }]}
        >
          <Text style={[s.metricLabel, { color: autres.length ? colors.warning : colors.brand }]}>
            {autres.length ? "À examiner" : "Rien à signaler"}
          </Text>
          {autres.length ? (
            autres.map((alert) => (
              <View key={alert.raison} style={{ gap: 2 }}>
                <Text style={[s.label, { color: colors.ink }]}>{alert.raison}</Text>
                <Text style={s.pillText}>Suite suggérée : {coachActionLabel[alert.action]}</Text>
              </View>
            ))
          ) : (
            <Text style={s.label}>Aucun écart récent signalé dans les données disponibles.</Text>
          )}
        </View>
      )}

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
              <Text style={s.historyMeta}>Progression : {formatWeight(progress.parcouruKg)} sur {formatWeight(progress.totalKg)}</Text>
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

      {progression.activite && (
        <View style={s.card}>
          <Text style={s.metricLabel}>Activité · 7 derniers jours</Text>
          <Text style={s.label}>{moyenneSummary(progression.activite)}</Text>
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
