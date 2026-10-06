import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { DailyBudgetChart } from "../../charts/DailyBudgetChart";
import {
  foodStatusPresentation,
  formatNutrition,
  groupEntriesByMeal,
  referenceFoodFromEntry,
} from "../../nutrition/presentation";
import { FoodIcon } from "../../nutrition/FoodIcon";
import { foodIconKind } from "../../nutrition/food-icon-kind";
import { MacroBreakdown } from "../../nutrition/MacroBreakdown";
import { formatUtcDay } from "../../measurements/presentation";
import { Button, Screen } from "../../plans/ui";
import type { LocalFoodEntry } from "../../sync/contracts";
import { etatChargement } from "../../sync/presentation";
import { SyncStatus } from "../../sync/SyncStatus";
import { useSync } from "../../sync/useSync";
import { styles as s } from "../../ui/styles";

const localStyles = StyleSheet.create({
  note: { color: "#536861", fontSize: 14, lineHeight: 20 },
});

function Entry({
  entry,
  onRemove,
  disabled,
}: {
  entry: LocalFoodEntry;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <View style={s.historyItem}>
      <View style={[s.historyMain, { alignItems: "center", gap: 10 }]}>
        <FoodIcon kind={foodIconKind(entry.nom)} size={34} />
        <Text style={[s.historyWeight, { flex: 1 }]}>{entry.nom}</Text>
        <Text style={s.label}>{formatNutrition(entry.caloriesKcal)} kcal</Text>
      </View>
      <Text style={s.historyMeta}>
        {formatNutrition(entry.quantiteGrammes)} g
        {entry.enAttente ? " · en attente de synchronisation" : ""}
      </Text>
      <MacroBreakdown
        variant="compact"
        proteines={entry.proteinesG}
        glucides={entry.glucidesG}
        lipides={entry.lipidesG}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Retirer ${entry.nom} du journal`}
        disabled={disabled}
        onPress={onRemove}
        style={{ alignSelf: "flex-start" }}
      >
        <Text style={[s.link, disabled && s.disabled]}>Retirer</Text>
      </Pressable>
    </View>
  );
}

export default function FoodJournalScreen() {
  const { vue, enCours, horsLigne, erreur, retirerEntree, ajouterAliment, synchroniser } =
    useSync();
  const status = vue.alimentation;
  const { loading, error } = etatChargement({ ...vue, enCours, horsLigne, erreur });
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [undoEntry, setUndoEntry] = useState<LocalFoodEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayUtc = new Date().toISOString().slice(0, 10);
  const today = status?.journaux.find((journal) => journal.jourUtc === todayUtc) ?? null;
  const totalKcal = today?.totalCaloriesKcal ?? 0;
  const budgetKcal = status?.budgetCalorique ?? 0;
  const entries = today?.entrees.slice().sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  ) ?? [];
  const mealGroups = groupEntriesByMeal(entries);

  // Écriture locale immédiate : fonctionne aussi hors ligne.
  const confirmRemove = async (entry: LocalFoodEntry) => {
    if (removingId) return;
    setRemovingId(entry.id);
    setRemoveError("");
    try {
      await retirerEntree(entry);
      setUndoEntry(entry);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoEntry(null), 6000);
    } catch {
      setRemoveError("Suppression impossible sur l’appareil. Réessaie.");
    } finally {
      setRemovingId(null);
    }
  };

  const undoRemove = async () => {
    const entry = undoEntry;
    if (!entry) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEntry(null);
    try {
      await ajouterAliment(
        referenceFoodFromEntry(entry),
        entry.quantiteGrammes,
        entry.categorieRepas === "non-classe" ? undefined : entry.categorieRepas,
      );
    } catch {
      setRemoveError("Impossible d'annuler le retrait.");
    }
  };

  return (
    <Screen>
      <View>
        <Text style={s.eyebrow}>ESPACE UTILISATEUR</Text>
        <Text style={s.title}>Mon journal alimentaire</Text>
      </View>
      <SyncStatus />

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
          <Button title="Réessayer" onPress={() => void synchroniser()} />
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
            accessibilityLabel={`Statut alimentaire : ${foodStatusPresentation[status.statut.statut].label}`}
            style={[
              s.statusCard,
              { backgroundColor: foodStatusPresentation[status.statut.statut].background },
            ]}
          >
            <Text style={[s.statusSymbol, { color: foodStatusPresentation[status.statut.statut].color }]}>
              {foodStatusPresentation[status.statut.statut].symbol}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={s.metricLabel}>SUIVI ALIMENTAIRE</Text>
              <Text style={[s.statusLabel, { color: foodStatusPresentation[status.statut.statut].color }]}>
                {foodStatusPresentation[status.statut.statut].label}
              </Text>
            </View>
          </View>

          <Text style={localStyles.note}>
            {status.statut.journal
              ? `Statut calculé à partir du dernier jour renseigné : ${formatUtcDay(status.statut.journal.jourUtc)} (UTC).`
              : "Aucune entrée alimentaire aujourd’hui ni hier."}
          </Text>

          <View style={s.card}>
            <Text style={s.cardTitle}>Aujourd’hui · {formatUtcDay(todayUtc)} (UTC)</Text>
            <Text style={s.metricValue}>
              {budgetKcal <= 0
                ? `${formatNutrition(totalKcal)} kcal consommées`
                : totalKcal <= budgetKcal
                  ? `${formatNutrition(budgetKcal - totalKcal)} kcal restantes`
                  : `${formatNutrition(totalKcal - budgetKcal)} kcal au-dessus de la cible`}
            </Text>
            <DailyBudgetChart
              total={totalKcal}
              budget={budgetKcal}
              hasEntries={entries.length > 0}
            />
            <MacroBreakdown
              proteines={today?.totalProteinesG ?? 0}
              glucides={today?.totalGlucidesG ?? 0}
              lipides={today?.totalLipidesG ?? 0}
              targets={
                status.ciblesMacros
                  ? {
                      proteines: status.ciblesMacros.proteinesG,
                      glucides: status.ciblesMacros.glucidesG,
                      lipides: status.ciblesMacros.lipidesG,
                    }
                  : undefined
              }
            />
            <Text style={s.historyMeta}>
              Cibles indicatives selon ton budget et ton activité ; le suivi reste calorique.
            </Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Aliments consommés aujourd’hui</Text>
            {entries.length === 0 ? (
              <Text style={s.text}>Aucun aliment consigné aujourd’hui.</Text>
            ) : (
              mealGroups.map((group) => (
                <View key={group.value} style={{ gap: 4 }}>
                  <View style={s.historyMain}>
                    <Text accessibilityRole="header" style={s.label}>{group.label}</Text>
                    <Text style={s.historyMeta}>
                      {formatNutrition(group.caloriesKcal)} kcal
                    </Text>
                  </View>
                  {group.entries.map((entry) => (
                    <Entry
                      key={entry.id}
                      entry={entry}
                      onRemove={() => void confirmRemove(entry)}
                      disabled={removingId !== null}
                    />
                  ))}
                </View>
              ))
            )}
            {undoEntry && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#eef4fa", borderRadius: 12, padding: 12 }}>
                <Text style={[s.text, { flex: 1 }]}>{undoEntry.nom} retiré.</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Annuler le retrait" onPress={() => void undoRemove()}>
                  <Text style={s.link}>Annuler</Text>
                </Pressable>
              </View>
            )}
            {!!removeError && <Text accessibilityRole="alert" style={s.error}>{removeError}</Text>}
            <Button title="Ajouter un aliment" onPress={() => router.push("/user/add-food")} disabled={removingId !== null} />
          </View>
          <Button title={enCours ? "Synchronisation…" : "Actualiser"} disabled={enCours} onPress={() => void synchroniser()} />
        </>
      )}

      <Button title="Retour au suivi de poids" onPress={() => router.replace("/user")} />
    </Screen>
  );
}
