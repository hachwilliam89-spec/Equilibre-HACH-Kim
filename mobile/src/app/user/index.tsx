import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { DailyBudgetChart } from "../../charts/DailyBudgetChart";
import { WeightTrajectoryChart } from "../../charts/WeightTrajectoryChart";
import { manualCorrectionSchema } from "../../measurements/api";
import {
  canSubmitManualCorrection,
  formatSignedWeight,
  formatUtcDay,
  formatWeight,
  measurementSourceLabel,
  measurementStatusLabel,
  trackingPresentation,
} from "../../measurements/presentation";
import { Button, Screen } from "../../plans/ui";
import type { LocalMeasurement } from "../../sync/contracts";
import { etatChargement } from "../../sync/presentation";
import { SyncStatus } from "../../sync/SyncStatus";
import { useSync } from "../../sync/useSync";
import { MeasurementField } from "../../ui/MeasurementField";
import { styles as s } from "../../ui/styles";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

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
      <Text style={s.cardTitle}>Budget du jour</Text>
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
  const { vue, enCours, horsLigne, erreur, saisirPoids, synchroniser } = useSync();
  const tracking = vue.suiviPoids;
  const history = vue.mesures;
  const { loading, error } = etatChargement({ ...vue, enCours, horsLigne, erreur });
  const retry = () => void synchroniser();
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

  return (
    <Screen>
      <View style={s.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>ESPACE UTILISATEUR</Text>
          <Text style={s.title}>Mon suivi de poids</Text>
        </View>
      </View>
      <SyncStatus />

      {loading ? (
        <View style={s.card}>
          <ActivityIndicator
            color="#087454"
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
      ) : tracking === null ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Aucun plan actif</Text>
          <Text style={s.text}>
            Votre coach doit activer un plan avant le démarrage du suivi de
            poids.
          </Text>
        </View>
      ) : (
        <>
          <View
            accessible
            accessibilityLabel={`Statut du suivi : ${trackingPresentation[tracking.statut].label}`}
            style={[
              s.statusCard,
              {
                backgroundColor:
                  trackingPresentation[tracking.statut].background,
              },
            ]}
          >
            <Text
              style={[
                s.statusSymbol,
                { color: trackingPresentation[tracking.statut].color },
              ]}
            >
              {trackingPresentation[tracking.statut].symbol}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={s.metricLabel}>STATUT DU SUIVI</Text>
              <Text
                style={[
                  s.statusLabel,
                  { color: trackingPresentation[tracking.statut].color },
                ]}
              >
                {trackingPresentation[tracking.statut].label}
              </Text>
            </View>
          </View>

          {(tracking.poidsAttendu !== null || tracking.derniereMesure) && (
            <View style={s.metricsRow}>
              {tracking.poidsAttendu !== null && (
                <Metric
                  label="Poids attendu"
                  value={formatWeight(tracking.poidsAttendu)}
                />
              )}
              {tracking.derniereMesure && (
                <Metric
                  label="Poids mesuré"
                  value={formatWeight(tracking.derniereMesure.poidsKg)}
                />
              )}
              {tracking.ecartKg !== null && (
                <Metric
                  label="Écart"
                  value={formatSignedWeight(tracking.ecartKg)}
                />
              )}
            </View>
          )}

          <View style={s.card}>
            <Text style={s.cardTitle}>Plan actif</Text>
            <View style={s.summaryRow}>
              <Text style={s.text}>Poids de départ</Text>
              <Text style={s.label}>
                {formatWeight(tracking.plan.poidsDepart)}
              </Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.text}>Poids cible</Text>
              <Text style={s.label}>
                {formatWeight(tracking.plan.poidsCible)}
              </Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.text}>Période</Text>
              <Text style={s.label}>
                {formatUtcDay(tracking.plan.dateDebut)} au{" "}
                {formatUtcDay(tracking.plan.dateCible)}
              </Text>
            </View>
          </View>
          <View style={s.card}>
            <WeightTrajectoryChart plan={tracking.plan} measurements={history} />
          </View>
          <DailyBudgetCard />
        </>
      )}

      {!loading && !error && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Historique</Text>
          {history.length === 0 ? (
            <Text style={s.text}>
              Aucune mesure enregistrée pour le moment.
            </Text>
          ) : (
            history.map((measurement) => (
              <HistoryItem key={measurement.id} measurement={measurement} />
            ))
          )}
        </View>
      )}

      {!loading && !error && correctionAvailable && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Saisir mon poids en secours</Text>
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
        </View>
      )}

      {!!correctionNotice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {correctionNotice}
        </Text>
      )}

      <Button title={enCours ? "Synchronisation…" : "Actualiser"} disabled={enCours} onPress={retry} />
      <Button title="Mon journal alimentaire" onPress={() => router.push("/user/journal")} />
      <Button title="Mon profil" onPress={() => router.push("/user/profile")} />
      <Button title="Mon compte" onPress={() => router.replace("/")} />
    </Screen>
  );
}
