import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { DailyBudgetChart } from "../../../charts/DailyBudgetChart";
import { WeightTrajectoryChart } from "../../../charts/WeightTrajectoryChart";
import { manualCorrectionSchema } from "../../../measurements/api";
import {
  canSubmitManualCorrection,
  formatUtcDay,
  formatWeight,
  goalProgress,
  measurementSourceLabel,
  measurementStatusLabel,
  trackingPresentation,
} from "../../../measurements/presentation";
import { Button, Screen } from "../../../plans/ui";
import type { LocalMeasurement } from "../../../sync/contracts";
import { etatChargement } from "../../../sync/presentation";
import { SyncStatus } from "../../../sync/SyncStatus";
import { useSync } from "../../../sync/useSync";
import { Collapsible } from "../../../ui/Collapsible";
import { todayLabel } from "../../../ui/dates";
import { useIdentity } from "../../../identity/store";
import { ChevronRight } from "../../../ui/icons";
import { MeasurementField } from "../../../ui/MeasurementField";
import { styles as s } from "../../../ui/styles";
import { colors } from "../../../ui/theme";

/** Nombre de pesées visibles avant « Voir tout ». */
const HISTORIQUE_COURT = 5;

function HistoryItem({ measurement }: { measurement: LocalMeasurement }) {
  return (
    <View style={s.historyItem}>
      <View style={s.historyMain}>
        <Text style={s.historyWeight}>{formatWeight(measurement.poidsKg)}</Text>
        <Text style={s.text}>{formatUtcDay(measurement.jourUtc)}</Text>
      </View>
      <Text style={s.historyMeta}>
        {measurementSourceLabel[measurement.source]} ·{" "}
        {measurement.enAttente
          ? "En attente de synchronisation"
          : measurementStatusLabel[measurement.statut]}
      </Text>
    </View>
  );
}

function DailyBudgetCard() {
  const alimentation = useSync((state) => state.vue.alimentation);
  const todayUtc = new Date().toISOString().slice(0, 10);
  const today = alimentation?.journaux.find((journal) => journal.jourUtc === todayUtc);
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Budget du jour, ouvrir mon journal alimentaire"
        onPress={() => router.navigate("/user/journal")}
        style={[s.summaryRow, { alignItems: "center" }]}
      >
        <Text style={s.cardTitle}>Budget du jour</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[s.link, { paddingVertical: 0 }]}>Journal</Text>
          <ChevronRight size={18} color={colors.brand} />
        </View>
      </Pressable>
      {alimentation === null ? (
        <Text style={s.text}>Aucun plan alimentaire actif.</Text>
      ) : (
        <DailyBudgetChart
          total={today?.totalCaloriesKcal ?? 0}
          budget={alimentation.budgetCalorique}
          hasEntries={(today?.entrees.length ?? 0) > 0}
        />
      )}
    </View>
  );
}

export default function WeightTrackingScreen() {
  const prenom = useIdentity((state) => state.me?.prenom);
  const { vue, enCours, horsLigne, erreur, saisirPoids, synchroniser } = useSync();
  const tracking = vue.suiviPoids;
  const history = vue.mesures;
  const { loading, error } = etatChargement({ ...vue, enCours, horsLigne, erreur });
  const retry = () => void synchroniser();
  const [showAll, setShowAll] = useState(false);
  const [correctionWeight, setCorrectionWeight] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [correctionNotice, setCorrectionNotice] = useState("");

  const submitCorrection = async () => {
    const parsed = manualCorrectionSchema.safeParse({
      poidsKg: Number(correctionWeight.trim().replace(",", ".")),
    });
    if (!parsed.success) {
      setCorrectionError(parsed.error.issues[0].message);
      setCorrectionNotice("");
      return;
    }
    setCorrectionError("");
    try {
      await saisirPoids(parsed.data.poidsKg);
      setCorrectionWeight("");
      setCorrectionNotice(
        horsLigne
          ? "Poids enregistré sur l’appareil. Il sera envoyé dès le retour du réseau."
          : "Votre poids a bien été enregistré.",
      );
    } catch {
      setCorrectionError("Impossible d’enregistrer votre poids sur l’appareil. Réessaie.");
    }
  };

  const correctionAvailable =
    tracking !== null && canSubmitManualCorrection(history);
  const suspectToday = history.some(
    (measurement) =>
      measurement.jourUtc === new Date().toISOString().slice(0, 10) &&
      measurement.source === "automatique" &&
      measurement.statut === "suspecte",
  );
  const visibleHistory = showAll ? history : history.slice(0, HISTORIQUE_COURT);
  const presentation = tracking ? trackingPresentation[tracking.statut] : null;
  const progress =
    tracking?.derniereMesure
      ? goalProgress(tracking.plan.poidsDepart, tracking.plan.poidsCible, tracking.derniereMesure.poidsKg)
      : null;

  return (
    <Screen
      inTabs
      eyebrow={todayLabel()}
      title="Mon suivi"
      subtitle={prenom ? `Bonjour ${prenom}` : undefined}
      refreshing={enCours && !loading}
      onRefresh={retry}
    >
      {loading ? (
        <View style={s.card}>
          <ActivityIndicator
            color={colors.brand}
            accessibilityLabel="Chargement du suivi de poids"
          />
          <Text style={s.text}>Chargement de votre suivi…</Text>
        </View>
      ) : error ? (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Button title="Réessayer" onPress={retry} />
        </View>
      ) : tracking === null || presentation === null ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Aucun plan actif</Text>
          <Text style={s.text}>
            Votre coach doit activer un plan avant le démarrage du suivi de
            poids.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.card}>
            <View
              accessible
              accessibilityLabel={`Statut du suivi : ${presentation.label}`}
              style={[s.pill, { backgroundColor: presentation.background, flexDirection: "row", gap: 6 }]}
            >
              <Text style={[s.pillText, { color: presentation.color }]}>{presentation.symbol}</Text>
              <Text style={[s.pillText, { color: presentation.color }]}>{presentation.label}</Text>
            </View>

            <View style={{ gap: 2 }}>
              <Text style={s.metricLabel}>Dernière pesée</Text>
              <Text style={{ fontSize: 40, fontWeight: "800", color: colors.ink }}>
                {tracking.derniereMesure ? formatWeight(tracking.derniereMesure.poidsKg) : "—"}
              </Text>
              {tracking.derniereMesure && (
                <Text style={s.historyMeta}>le {formatUtcDay(tracking.derniereMesure.jourUtc)}</Text>
              )}
            </View>

            {progress && (
              <View
                accessible
                accessibilityLabel={`Progression : ${formatWeight(progress.parcouruKg)} sur ${formatWeight(progress.totalKg)}, cible ${formatWeight(tracking.plan.poidsCible)}`}
                style={{ gap: 6 }}
              >
                <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.mint, overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${Math.max(progress.fraction * 100, 3)}%`,
                      height: "100%",
                      borderRadius: 5,
                      backgroundColor: colors.brandBright,
                    }}
                  />
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.historyMeta}>
                    Progression : {formatWeight(progress.parcouruKg)} sur {formatWeight(progress.totalKg)}
                  </Text>
                  <Text style={[s.historyMeta, { fontWeight: "700", color: colors.ink }]}>
                    Cible {formatWeight(tracking.plan.poidsCible)}
                  </Text>
                </View>
              </View>
            )}

            {tracking.poidsAttendu !== null && tracking.ecartKg !== null && (
              <View style={{ gap: 2 }}>
                <Text style={s.metricLabel}>Écart à la trajectoire</Text>
                <Text style={[s.label, { color: presentation.color }]}>
                  {Math.abs(tracking.ecartKg) < 0.05
                    ? "Sur la trajectoire"
                    : `${formatWeight(Math.abs(tracking.ecartKg))} ${tracking.ecartKg > 0 ? "au-dessus" : "en dessous"}`}
                </Text>
                <Text style={s.historyMeta}>Poids attendu aujourd’hui : {formatWeight(tracking.poidsAttendu)}</Text>
              </View>
            )}
          </View>

          <SyncStatus />

          <View style={s.card}>
            <WeightTrajectoryChart plan={tracking.plan} measurements={history} showLast={false} />
            <Text style={s.historyMeta}>
              Plan du {formatUtcDay(tracking.plan.dateDebut)} au{" "}
              {formatUtcDay(tracking.plan.dateCible)} · départ{" "}
              {formatWeight(tracking.plan.poidsDepart)}
            </Text>
          </View>
          <DailyBudgetCard />
        </>
      )}

      {(loading || error || tracking === null) && <SyncStatus />}

      {!loading && !error && correctionAvailable && (
        <Collapsible
          title="Saisir mon poids"
          hint={
            suspectToday
              ? "Mesure de la balance suspecte : saisissez votre poids."
              : "Si la balance n’a rien envoyé aujourd’hui."
          }
          initiallyOpen={suspectToday}
        >
          <Text style={s.text}>
            {suspectToday
              ? "La mesure de la balance a été détectée comme suspecte. Vous pouvez saisir votre poids manuellement."
              : "Utilisez cette saisie si aucune mesure valide de la balance n’a été enregistrée aujourd’hui."}
          </Text>
          <MeasurementField
            label="Poids du jour"
            unit="kg"
            value={correctionWeight}
            onChange={setCorrectionWeight}
            error={correctionError}
          />
          <Button
            title="Enregistrer mon poids"
            onPress={() => void submitCorrection()}
          />
        </Collapsible>
      )}

      {!!correctionNotice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {correctionNotice}
        </Text>
      )}

      {!loading && !error && (
        <View style={s.card}>
          <View style={[s.summaryRow, { alignItems: "center" }]}>
            <Text style={s.cardTitle}>Historique</Text>
            {history.length > 0 && (
              <Text style={s.historyMeta}>
                {history.length} pesée{history.length > 1 ? "s" : ""}
              </Text>
            )}
          </View>
          {history.length === 0 ? (
            <Text style={s.text}>
              Aucune mesure enregistrée pour le moment.
            </Text>
          ) : (
            visibleHistory.map((measurement) => (
              <HistoryItem key={measurement.id} measurement={measurement} />
            ))
          )}
          {history.length > HISTORIQUE_COURT && (
            <Button
              variant="secondary"
              title={showAll ? "Afficher moins" : `Voir tout l’historique (${history.length})`}
              onPress={() => setShowAll((value) => !value)}
            />
          )}
        </View>
      )}
    </Screen>
  );
}
