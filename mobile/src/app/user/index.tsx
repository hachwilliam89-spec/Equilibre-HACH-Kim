import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { WeightTrajectoryChart } from "../../charts/WeightTrajectoryChart";
import { getFoodBudgetStatus, type FoodBudgetStatus } from "../../nutrition/api";
import { formatNutrition, journalForDay } from "../../nutrition/presentation";
import {
  correctWeight,
  getMeasurementHistory,
  getWeightTracking,
  manualCorrectionSchema,
  type Measurement,
  type WeightTracking,
} from "../../measurements/api";
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

function HistoryItem({ measurement }: { measurement: Measurement }) {
  return (
    <View style={s.historyItem}>
      <View style={s.historyMain}>
        <Text style={s.historyWeight}>{formatWeight(measurement.poidsKg)}</Text>
        <Text style={s.text}>{formatUtcDay(measurement.jourUtc)}</Text>
      </View>
      <Text style={s.historyMeta}>
        {measurementSourceLabel[measurement.source]} ·{" "}
        {measurementStatusLabel[measurement.statut]}
      </Text>
    </View>
  );
}

function DailyBudgetCard() {
  const [status, setStatus] = useState<FoodBudgetStatus>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [todayUtc, setTodayUtc] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setTodayUtc(new Date().toISOString().slice(0, 10));
      setLoading(true);
      setError("");
      void getFoodBudgetStatus()
        .then((next) => {
          if (active) setStatus(next);
        })
        .catch(() => {
          if (active) setError("Budget indisponible pour le moment.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const today = journalForDay(status, todayUtc);
  const total = today?.totalCaloriesKcal ?? 0;
  const budget = status?.budgetCalorique ?? 0;
  const progress = budget > 0 ? Math.min(Math.max(total / budget, 0), 1) : 0;
  const remaining = budget - total;
  const budgetNote = !today
    ? "Aucune entrée consignée aujourd’hui."
    : remaining > 0
      ? `${formatNutrition(remaining)} kcal restantes`
      : remaining < 0
        ? `Budget dépassé de ${formatNutrition(-remaining)} kcal`
        : "Budget atteint.";
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Budget du jour</Text>
      {loading ? (
        <ActivityIndicator color="#087454" accessibilityLabel="Chargement du budget calorique" />
      ) : error ? (
        <Text style={s.error}>{error}</Text>
      ) : status === null ? (
        <Text style={s.text}>Aucun plan alimentaire actif.</Text>
      ) : (
        <>
          <Text style={s.metricValue}>
            {formatNutrition(total)} / {formatNutrition(budget)} kcal
          </Text>
          <View
            accessible
            accessibilityLabel={`${formatNutrition(total)} kilocalories consignées aujourd’hui sur ${formatNutrition(budget)} prévues`}
            style={{
              height: 12,
              borderRadius: 6,
              backgroundColor: "#e4ece7",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: total > budget + 150 ? "#9a4d00" : "#087454",
              }}
            />
          </View>
          <Text style={s.historyMeta}>{budgetNote}</Text>
        </>
      )}
    </View>
  );
}

export default function WeightTrackingScreen() {
  const [tracking, setTracking] = useState<WeightTracking>(null);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [correctionWeight, setCorrectionWeight] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionError, setCorrectionError] = useState("");
  const [correctionNotice, setCorrectionNotice] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([getWeightTracking(), getMeasurementHistory()])
      .then(([nextTracking, nextHistory]) => {
        if (!active) return;
        setTracking(nextTracking);
        setHistory(nextHistory);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible de charger le suivi. Réessaie.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const retry = () => {
    setLoading(true);
    setError("");
    setReload((value) => value + 1);
  };

  const submitCorrection = async () => {
    if (correctionBusy) return;
    const parsed = manualCorrectionSchema.safeParse({
      poidsKg: Number(correctionWeight.trim().replace(",", ".")),
    });
    if (!parsed.success) {
      setCorrectionError(parsed.error.issues[0].message);
      setCorrectionNotice("");
      return;
    }
    setCorrectionBusy(true);
    setCorrectionError("");
    setCorrectionNotice("");
    try {
      await correctWeight(parsed.data);
      setCorrectionWeight("");
      setCorrectionNotice("Votre poids a bien été enregistré.");
      setLoading(true);
      setError("");
      setReload((value) => value + 1);
    } catch (cause) {
      setCorrectionError(
        cause instanceof Error
          ? cause.message
          : "Impossible d’enregistrer votre poids. Réessaie.",
      );
    } finally {
      setCorrectionBusy(false);
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
            disabled={correctionBusy}
          />
          <Button
            title={correctionBusy ? "Enregistrement…" : "Enregistrer mon poids"}
            disabled={correctionBusy}
            onPress={() => void submitCorrection()}
          />
        </View>
      )}

      {!!correctionNotice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {correctionNotice}
        </Text>
      )}

      <Button title="Actualiser" disabled={loading} onPress={retry} />
      <Button title="Mon journal alimentaire" onPress={() => router.push("/user/journal")} />
      <Button title="Mon profil" onPress={() => router.push("/user/profile")} />
      <Button title="Mon compte" onPress={() => router.replace("/")} />
    </Screen>
  );
}
