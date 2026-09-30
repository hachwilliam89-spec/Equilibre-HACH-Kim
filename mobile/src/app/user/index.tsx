import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  getMeasurementHistory,
  getWeightTracking,
  type Measurement,
  type WeightTracking,
} from "../../measurements/api";
import {
  formatSignedWeight,
  formatUtcDay,
  formatWeight,
  measurementSourceLabel,
  measurementStatusLabel,
  trackingPresentation,
} from "../../measurements/presentation";
import { Button, Screen } from "../../plans/ui";
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
        {measurementSourceLabel[measurement.source]} · {measurementStatusLabel[measurement.statut]}
      </Text>
    </View>
  );
}

export default function WeightTrackingScreen() {
  const [tracking, setTracking] = useState<WeightTracking>(null);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

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
            Votre coach doit activer un plan avant le démarrage du suivi de poids.
          </Text>
        </View>
      ) : (
        <>
          <View
            accessible
            accessibilityLabel={`Statut du suivi : ${trackingPresentation[tracking.statut].label}`}
            style={[
              s.statusCard,
              { backgroundColor: trackingPresentation[tracking.statut].background },
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
              <Text style={s.label}>{formatWeight(tracking.plan.poidsDepart)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.text}>Poids cible</Text>
              <Text style={s.label}>{formatWeight(tracking.plan.poidsCible)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.text}>Période</Text>
              <Text style={s.label}>
                {formatUtcDay(tracking.plan.dateDebut)} au {formatUtcDay(tracking.plan.dateCible)}
              </Text>
            </View>
          </View>
        </>
      )}

      {!loading && !error && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Historique</Text>
          {history.length === 0 ? (
            <Text style={s.text}>Aucune mesure enregistrée pour le moment.</Text>
          ) : (
            history.map((measurement) => (
              <HistoryItem key={measurement.id} measurement={measurement} />
            ))
          )}
        </View>
      )}

      <Button title="Actualiser" disabled={loading} onPress={retry} />
      <Button title="Mon profil" onPress={() => router.push("/user/profile")} />
      <Button title="Mon compte" onPress={() => router.replace("/")} />
    </Screen>
  );
}
