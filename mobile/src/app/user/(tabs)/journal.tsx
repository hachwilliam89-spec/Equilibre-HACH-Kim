import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DailyBudgetChart } from "../../../charts/DailyBudgetChart";
import {
  dailyJournalStatusPresentation,
  formatNutrition,
  groupEntriesByMeal,
  referenceFoodFromEntry, formatKcal, suggestedMeal } from "../../../nutrition/presentation";
import { AddFoodSheet } from "../../../nutrition/AddFoodSheet";
import { getFoodJournalForDay, type FoodJournal, type MealCategory } from "../../../nutrition/api";
import { derniersJours, type JourJournal } from "../../../nutrition/journal-days";
import { FoodIcon } from "../../../nutrition/FoodIcon";
import { foodIconKind } from "../../../nutrition/food-icon-kind";
import { MacroBreakdown } from "../../../nutrition/MacroBreakdown";
import { Button, Screen } from "../../../plans/ui";
import { todayLabel } from "../../../ui/dates";
import { PlusIcon } from "../../../ui/icons";
import { colors } from "../../../ui/theme";
import type { LocalFoodEntry } from "../../../sync/contracts";
import { etatChargement } from "../../../sync/presentation";
import { SyncStatus } from "../../../sync/SyncStatus";
import { useSync } from "../../../sync/useSync";
import { styles as s } from "../../../ui/styles";

const localStyles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});

/** Journal chargé depuis l'API pour une journée hors de la base embarquée. */
type JournalDistant =
  | { etat: "ok"; journal: FoodJournal | null }
  | { etat: "erreur"; message: string };

/** Pastilles des 7 derniers jours ; la journée choisie est mise en avant. */
function DaySelector({ jours, choisi, onChange }: { jours: JourJournal[]; choisi: string; onChange: (jourUtc: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
    >
      {jours.map((jour) => {
        const selected = jour.jourUtc === choisi;
        return (
          <Pressable
            key={jour.jourUtc}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`Journal : ${jour.long}`}
            onPress={() => onChange(jour.jourUtc)}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected ? colors.brand : colors.borderStrong,
              backgroundColor: selected ? colors.brand : pressed ? colors.mintSoft : colors.card,
            })}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: selected ? colors.onBrand : colors.ink }}>
              {jour.court}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Entry({
  entry,
  onRemove,
  onEdit,
  disabled,
  readOnly = false,
}: {
  entry: LocalFoodEntry;
  onRemove: () => void;
  onEdit: () => void;
  disabled: boolean;
  readOnly?: boolean;
}) {
  return (
    <View style={s.historyItem}>
      <View style={[s.historyMain, { alignItems: "center", gap: 10 }]}>
        <FoodIcon kind={foodIconKind(entry.nom)} size={34} />
        <Text style={[s.historyWeight, { flex: 1 }]}>{entry.nom}</Text>
        <Text style={s.label}>{formatKcal(entry.caloriesKcal)} kcal</Text>
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
      {!readOnly && <View style={{ flexDirection: "row", gap: 20 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Modifier la quantité de ${entry.nom}`}
          disabled={disabled}
          onPress={onEdit}
          hitSlop={6}
        >
          <Text style={[s.link, disabled && s.disabled]}>Modifier</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${entry.nom} du journal`}
          disabled={disabled}
          onPress={onRemove}
          hitSlop={6}
        >
          <Text style={[s.link, { color: colors.muted }, disabled && s.disabled]}>Retirer</Text>
        </Pressable>
      </View>}
    </View>
  );
}

export default function FoodJournalScreen() {
  const { vue, enCours, horsLigne, erreur, retirerEntree, ajouterAliment, modifierEntree, synchroniser } =
    useSync();
  const [editing, setEditing] = useState<LocalFoodEntry | null>(null);
  const [editMeal, setEditMeal] = useState<Exclude<MealCategory, "non-classe">>("collation");
  const startEdit = (entry: LocalFoodEntry) => {
    setEditMeal(entry.categorieRepas === "non-classe" ? suggestedMeal(new Date().getHours()) : entry.categorieRepas);
    setEditing(entry);
  };
  const status = vue.alimentation;
  const { loading, error } = etatChargement({ ...vue, enCours, horsLigne, erreur });
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [undoEntry, setUndoEntry] = useState<LocalFoodEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jours = derniersJours();
  const [jourChoisi, setJourChoisi] = useState(jours[0].jourUtc);
  const choix = jours.find((jour) => jour.jourUtc === jourChoisi) ?? jours[0];
  const [distants, setDistants] = useState<Record<string, JournalDistant>>({});
  const distant = choix.horsLigne ? undefined : distants[choix.jourUtc];

  // Journées anciennes : chargées une fois depuis l'API, en lecture seule.
  useEffect(() => {
    if (choix.horsLigne || distants[choix.jourUtc]) return;
    let actif = true;
    const jour = choix.jourUtc;
    getFoodJournalForDay(jour)
      .then((journal) => {
        if (actif) setDistants((prev) => ({ ...prev, [jour]: { etat: "ok", journal } }));
      })
      .catch((cause: unknown) => {
        if (actif) {
          setDistants((prev) => ({
            ...prev,
            [jour]: {
              etat: "erreur",
              message: cause instanceof Error ? cause.message : "Impossible de charger ce jour.",
            },
          }));
        }
      });
    return () => {
      actif = false;
    };
  }, [choix.horsLigne, choix.jourUtc, distants]);

  const journalDistant = distant?.etat === "ok" && distant.journal
    ? { ...distant.journal, entrees: distant.journal.entrees.map((entree) => ({ ...entree, enAttente: false })) }
    : null;
  const today = choix.horsLigne
    ? status?.journaux.find((journal) => journal.jourUtc === choix.jourUtc) ?? null
    : journalDistant;
  const chargementJour = !choix.horsLigne && distant === undefined;
  const erreurJour = distant?.etat === "erreur" ? distant.message : "";
  const totalKcal = today?.totalCaloriesKcal ?? 0;
  // Journée passée : budget copié dans son journal à sa création.
  const budgetKcal = (choix.modifiable ? undefined : today?.budgetCalorique) ?? status?.budgetCalorique ?? 0;
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

  const addFood = () => router.push("/user/add-food");
  const statusPresentation = status
    ? dailyJournalStatusPresentation(totalKcal, budgetKcal, entries.length > 0)
    : null;

  return (
    <Screen
      inTabs
      eyebrow={todayLabel()}
      title="Mon journal"
      refreshing={enCours && !loading}
      onRefresh={() => void synchroniser()}
      floating={
        status && !loading && !error && choix.modifiable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un aliment"
            disabled={removingId !== null}
            onPress={addFood}
            style={({ pressed }) => [s.fab, pressed && { opacity: 0.9 }]}
          >
            <PlusIcon color={colors.onBrand} size={22} strokeWidth={2.6} />
            <Text style={s.buttonText}>Ajouter</Text>
          </Pressable>
        ) : undefined
      }
    >
      {loading ? (
        <View style={s.card}>
          <ActivityIndicator
            color={colors.brand}
            accessibilityLabel="Chargement du journal alimentaire"
          />
          <Text style={s.text}>Chargement du journal…</Text>
        </View>
      ) : error ? (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>{error}</Text>
          <Button title="Réessayer" onPress={() => void synchroniser()} />
        </View>
      ) : status === null || statusPresentation === null ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Aucun plan actif</Text>
          <Text style={s.text}>
            Votre coach doit activer un plan avant le suivi de votre alimentation.
          </Text>
        </View>
      ) : (
        <>
          <DaySelector jours={jours} choisi={choix.jourUtc} onChange={setJourChoisi} />
          {chargementJour || erreurJour ? (
            <View style={s.card}>
              {chargementJour ? (
                <>
                  <ActivityIndicator color={colors.brand} accessibilityLabel={`Chargement du journal : ${choix.long}`} />
                  <Text style={s.text}>Chargement du journal…</Text>
                </>
              ) : (
                <>
                  <Text accessibilityRole="alert" style={s.error}>{erreurJour}</Text>
                  <Text style={localStyles.note}>Les journées avant hier se consultent en ligne.</Text>
                  <Button
                    title="Réessayer"
                    onPress={() => setDistants(({ [choix.jourUtc]: _retire, ...reste }) => reste)}
                  />
                </>
              )}
            </View>
          ) : (
          <>
          <View style={s.card}>
            <View style={[s.summaryRow, { alignItems: "center" }]}>
              <Text style={s.metricLabel}>{choix.long}</Text>
              <View
                accessible
                accessibilityLabel={`Statut alimentaire : ${statusPresentation.label}`}
                style={[s.pill, { backgroundColor: statusPresentation.background, flexDirection: "row", gap: 5 }]}
              >
                <Text style={[s.pillText, { color: statusPresentation.color }]}>{statusPresentation.symbol}</Text>
                <Text style={[s.pillText, { color: statusPresentation.color }]}>{statusPresentation.label}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 30, fontWeight: "800", color: colors.ink }}>
              {formatKcal(totalKcal)} kcal consommées
            </Text>
            <DailyBudgetChart
              total={totalKcal}
              budget={budgetKcal}
              hasEntries={entries.length > 0}
              showTotal={false}
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
            <Text style={localStyles.note}>
              {choix.modifiable
                ? "Cibles indicatives selon ton budget et ton activité ; le suivi reste calorique."
                : "Journée passée : consultation en lecture seule."}
            </Text>
          </View>

          <SyncStatus />

          <View style={s.card}>
            <Text style={s.cardTitle}>Aliments consommés</Text>
            {entries.length === 0 ? (
              choix.modifiable ? (
                <>
                  <Text style={s.text}>Aucun aliment consigné aujourd’hui.</Text>
                  <Button title="Ajouter mon premier aliment" variant="secondary" onPress={addFood} />
                </>
              ) : (
                <Text style={s.text}>Aucun aliment consigné ce jour-là.</Text>
              )
            ) : (
              mealGroups.map((group) => (
                <View key={group.value} style={{ gap: 4 }}>
                  <View style={[s.historyMain, { marginTop: 4 }]}>
                    <Text accessibilityRole="header" style={[s.metricLabel, { color: colors.brand }]}>{group.label}</Text>
                    <Text style={s.historyMeta}>
                      {formatKcal(group.caloriesKcal)} kcal
                    </Text>
                  </View>
                  {group.entries.map((entry) => (
                    <Entry
                      key={entry.id}
                      entry={entry}
                      onRemove={() => void confirmRemove(entry)}
                      onEdit={() => startEdit(entry)}
                      disabled={removingId !== null}
                      readOnly={!choix.modifiable}
                    />
                  ))}
                </View>
              ))
            )}
            {undoEntry && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.mint, borderRadius: 12, padding: 12 }}>
                <Text style={[s.text, { flex: 1 }]}>{undoEntry.nom} retiré.</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Annuler le retrait" onPress={() => void undoRemove()}>
                  <Text style={s.link}>Annuler</Text>
                </Pressable>
              </View>
            )}
            {!!removeError && <Text accessibilityRole="alert" style={s.error}>{removeError}</Text>}
          </View>
          </>
          )}
        </>
      )}

      {(loading || error || status === null) && <SyncStatus />}
      <AddFoodSheet
        food={editing ? referenceFoodFromEntry(editing) : null}
        meal={editMeal}
        onMealChange={setEditMeal}
        onClose={() => setEditing(null)}
        onAdded={() => setEditing(null)}
        edit={editing ? {
          quantiteGrammes: editing.quantiteGrammes,
          caloriesKcal: editing.caloriesKcal,
          onSave: (quantite, meal) => modifierEntree(editing, quantite, meal),
        } : undefined}
      />
    </Screen>
  );
}
