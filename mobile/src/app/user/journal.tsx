import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  getFoodBudgetStatus,
  type FoodBudgetStatus,
  type FoodEntry,
} from "../../nutrition/api";
import {
  foodStatusPresentation,
  formatNutrition,
  journalForDay,
} from "../../nutrition/presentation";
import { formatUtcDay } from "../../measurements/presentation";
import { Button, Screen } from "../../plans/ui";
import { styles as s } from "../../ui/styles";

const localStyles = StyleSheet.create({
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e4ece7",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#087454",
  },
  note: { color: "#536861", fontSize: 14, lineHeight: 20 },
});

function Entry({ entry }: { entry: FoodEntry }) {
  return (
    <View style={s.historyItem}>
      <View style={s.historyMain}>
        <Text style={[s.historyWeight, { flex: 1 }]}>{entry.nom}</Text>
        <Text style={s.label}>{formatNutrition(entry.caloriesKcal)} kcal</Text>
      </View>
      <Text style={s.historyMeta}>
        {formatNutrition(entry.quantiteGrammes)} g · P {formatNutrition(entry.proteinesG)} g
        {" · "}G {formatNutrition(entry.glucidesG)} g · L {formatNutrition(entry.lipidesG)} g
      </Text>
    </View>
  );
}

export default function FoodJournalScreen() {
  const [status, setStatus] = useState<FoodBudgetStatus>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      if (reload > 0) setStatus(null);
      void getFoodBudgetStatus()
        .then((next) => {
          if (active) setStatus(next);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(
            cause instanceof Error
              ? cause.message
              : "Impossible de charger votre journal alimentaire.",
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [reload]),
  );

  const todayUtc = new Date().toISOString().slice(0, 10);
  const today = journalForDay(status, todayUtc);
  const totalKcal = today?.totalCaloriesKcal ?? 0;
  const budgetKcal = status?.budgetCalorique ?? 0;
  const progress = budgetKcal > 0 ? Math.min(totalKcal / budgetKcal, 1) : 0;
  const entries = today?.entrees.slice().sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  ) ?? [];

  return (
    <Screen>
      <View>
        <Text style={s.eyebrow}>ESPACE UTILISATEUR</Text>
        <Text style={s.title}>Mon journal alimentaire</Text>
      </View>

      {loading ? (
        <View style={s.card}>
          <ActivityIndicator
            color="#087454"
            accessibilityLabel="Chargement du journal alimentaire"
          />
          <Text style={s.text}>Chargement du journal…</Text>
        </View>
      ) : error ? (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>{error}</Text>
          <Button title="Réessayer" onPress={() => setReload((value) => value + 1)} />
        </View>
      ) : status === null ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Aucun plan actif</Text>
          <Text style={s.text}>
            Votre coach doit activer un plan avant le suivi de votre alimentation.
          </Text>
        </View>
      ) : (
        <>
          <View
            accessible
            accessibilityLabel={`Statut alimentaire : ${foodStatusPresentation[status.statut].label}`}
            style={[
              s.statusCard,
              { backgroundColor: foodStatusPresentation[status.statut].background },
            ]}
          >
            <Text style={[s.statusSymbol, { color: foodStatusPresentation[status.statut].color }]}>
              {foodStatusPresentation[status.statut].symbol}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={s.metricLabel}>SUIVI ALIMENTAIRE</Text>
              <Text style={[s.statusLabel, { color: foodStatusPresentation[status.statut].color }]}>
                {foodStatusPresentation[status.statut].label}
              </Text>
            </View>
          </View>

          <Text style={localStyles.note}>
            {status.journal
              ? `Statut calculé à partir du dernier jour renseigné : ${formatUtcDay(status.journal.jourUtc)} (UTC).`
              : "Aucune entrée alimentaire enregistrée pour ce plan."}
          </Text>

          <View style={s.card}>
            <Text style={s.cardTitle}>Aujourd’hui · {formatUtcDay(todayUtc)} (UTC)</Text>
            <Text style={s.metricValue}>
              {formatNutrition(totalKcal)} / {formatNutrition(budgetKcal)} kcal
            </Text>
            {today && (
              <Text style={s.text}>
                Écart au budget : {totalKcal > budgetKcal ? "+" : ""}
                {formatNutrition(totalKcal - budgetKcal)} kcal
              </Text>
            )}
            <View
              accessible
              accessibilityLabel={`${formatNutrition(totalKcal)} kilocalories consommées sur ${formatNutrition(budgetKcal)} prévues`}
              style={localStyles.progressTrack}
            >
              <View
                style={[
                  localStyles.progressFill,
                  {
                    width: `${Math.round(progress * 100)}%` as `${number}%`,
                    backgroundColor: totalKcal > budgetKcal + 150 ? "#9a4d00" : "#087454",
                  },
                ]}
              />
            </View>
            <Text style={s.text}>
              {`Protéines ${formatNutrition(today?.totalProteinesG ?? 0)} g · Glucides ${formatNutrition(today?.totalGlucidesG ?? 0)} g · Lipides ${formatNutrition(today?.totalLipidesG ?? 0)} g`}
            </Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Aliments consommés aujourd’hui</Text>
            {entries.length === 0 ? (
              <Text style={s.text}>Aucun aliment consigné aujourd’hui.</Text>
            ) : (
              entries.map((entry) => <Entry key={entry.id} entry={entry} />)
            )}
          </View>
          <Button title="Actualiser" onPress={() => setReload((value) => value + 1)} />
        </>
      )}

      <Button title="Retour au suivi de poids" onPress={() => router.replace("/user")} />
    </Screen>
  );
}
