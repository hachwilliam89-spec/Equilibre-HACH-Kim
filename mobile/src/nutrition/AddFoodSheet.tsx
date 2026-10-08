import { useState } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../plans/ui";
import { useSync } from "../sync/useSync";
import { CloseIcon, MinusIcon, PlusIcon } from "../ui/icons";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import type { MealCategory, ReferenceFood } from "./api";
import { FoodIcon } from "./FoodIcon";
import { foodIconKind } from "./food-icon-kind";
import { MacroBreakdown } from "./MacroBreakdown";
import {
  defaultPortion, formatNutrition, mealCategories,
  nutritionForQuantity, parseFoodQuantity, quickPortions,
} from "./presentation";

type Meal = Exclude<MealCategory, "non-classe">;
const PAS_GRAMMES = 10;

const mealLabel = (value: Meal) =>
  value === "petit-dejeuner" ? "Petit-déj." : mealCategories.find((m) => m.value === value)!.label;

/** « au déjeuner », « à la collation »… pour le bouton d'ajout. */
export const mealTarget: Record<Meal, string> = {
  "petit-dejeuner": "au petit-déjeuner",
  dejeuner: "au déjeuner",
  diner: "au dîner",
  collation: "à la collation",
};

function StepButton({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
        pressed && { backgroundColor: "#cfe9db" },
        disabled && s.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Feuille d'ajout : quantité pré-remplie (portion usuelle), repas présélectionné,
 * aperçu des calories et du reste du budget du jour. Un seul appui suffit
 * dans le cas courant.
 */
export function AddFoodSheet({
  food,
  meal,
  onMealChange,
  onClose,
  onAdded,
}: {
  food: ReferenceFood | null;
  meal: Meal;
  onMealChange: (meal: Meal) => void;
  onClose: () => void;
  onAdded: (food: ReferenceFood, meal: Meal) => void;
}) {
  return (
    <Modal visible={food !== null} transparent animationType="slide" onRequestClose={onClose}>
      {food && (
        <SheetContent key={food.id} food={food} meal={meal} onMealChange={onMealChange} onClose={onClose} onAdded={onAdded} />
      )}
    </Modal>
  );
}

function SheetContent({
  food, meal, onMealChange, onClose, onAdded,
}: {
  food: ReferenceFood;
  meal: Meal;
  onMealChange: (meal: Meal) => void;
  onClose: () => void;
  onAdded: (food: ReferenceFood, meal: Meal) => void;
}) {
  const insets = useSafeAreaInsets();
  const ajouterAliment = useSync((state) => state.ajouterAliment);
  const alimentation = useSync((state) => state.vue.alimentation);
  const [quantityText, setQuantityText] = useState(String(defaultPortion(food)));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const quantity = parseFoodQuantity(quantityText);
  const preview = quantity !== null ? nutritionForQuantity(food, quantity) : null;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const consumed = alimentation?.journaux.find((j) => j.jourUtc === todayUtc)?.totalCaloriesKcal ?? 0;
  const remaining = alimentation && preview ? alimentation.budgetCalorique - consumed - preview.caloriesKcal : null;

  const step = (delta: number) => {
    const current = quantity ?? 0;
    const next = Math.max(PAS_GRAMMES, Math.round((current + delta) / PAS_GRAMMES) * PAS_GRAMMES);
    setQuantityText(String(Math.min(next, 10000)));
    setError("");
  };

  const close = () => { if (!busy) onClose(); };

  const submit = async () => {
    if (busy) return;
    if (quantity === null) {
      setError("Saisissez une quantité supérieure à 0 g et au plus égale à 10 000 g.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await ajouterAliment(food, quantity, meal);
      onAdded(food, meal);
    } catch {
      setError("Ajout impossible sur l’appareil. Vérifiez votre journal avant de réessayer.");
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable accessibilityLabel="Fermer" onPress={close} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0a2a2066" }} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%" }}>
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <FoodIcon kind={foodIconKind(food.nom, food.categorie)} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.cardTitle}>{food.nom}</Text>
              <Text style={s.historyMeta}>{formatNutrition(food.caloriesKcalPour100g)} kcal pour 100 g</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" disabled={busy} onPress={close} hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.page }}>
              <CloseIcon size={20} color={colors.muted} />
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={s.metricLabel}>Quantité</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <StepButton label={`Retirer ${PAS_GRAMMES} g`} disabled={busy || (quantity ?? 0) <= PAS_GRAMMES} onPress={() => step(-PAS_GRAMMES)}>
                <MinusIcon color={colors.brand} strokeWidth={2.6} />
              </StepButton>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "center", borderRadius: 16, backgroundColor: colors.mintSoft, borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: 6 }}>
                <TextInput
                  accessibilityLabel="Quantité consommée (g)"
                  value={quantityText}
                  onChangeText={(value) => { setQuantityText(value); setError(""); }}
                  keyboardType="decimal-pad"
                  editable={!busy}
                  selectTextOnFocus
                  style={{ fontSize: 30, fontWeight: "800", color: colors.ink, textAlign: "right", width: 96, padding: 0 }}
                />
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.muted, width: 96 }}> g</Text>
              </View>
              <StepButton label={`Ajouter ${PAS_GRAMMES} g`} disabled={busy} onPress={() => step(PAS_GRAMMES)}>
                <PlusIcon color={colors.brand} strokeWidth={2.6} />
              </StepButton>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {quickPortions(food).map((portion) => (
                <Pressable
                  key={portion.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Portion ${portion.label}`}
                  disabled={busy}
                  onPress={() => { setQuantityText(String(portion.grams)); setError(""); }}
                  style={[s.choice, { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 }, quantity === portion.grams && s.choiceSelected]}
                >
                  <Text style={s.label}>{portion.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={s.metricLabel}>Repas</Text>
            <View style={[s.tabs, { padding: 3 }]} accessibilityRole="radiogroup">
              {mealCategories.map(({ value, label }) => {
                const selected = meal === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: selected }}
                    disabled={busy}
                    onPress={() => onMealChange(value as Meal)}
                    style={[s.tab, { minHeight: 40, paddingHorizontal: 4 }, selected && s.tabSelected]}
                  >
                    <Text numberOfLines={1} style={[s.tabText, { fontSize: 13 }, selected && s.tabTextSelected]}>
                      {mealLabel(value as Meal)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {preview && (
            <View style={{ gap: 10, backgroundColor: colors.mintSoft, borderRadius: 18, padding: 16 }}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: colors.ink }}>
                {formatNutrition(preview.caloriesKcal)} kcal
              </Text>
              {remaining !== null && (
                <Text style={[s.label, { color: remaining < 0 ? colors.warning : colors.brand }]}>
                  {remaining >= 0
                    ? `Il vous restera ${formatNutrition(remaining)} kcal aujourd’hui`
                    : `${formatNutrition(-remaining)} kcal au-dessus du budget du jour`}
                </Text>
              )}
              <MacroBreakdown variant="compact" proteines={preview.proteinesG} glucides={preview.glucidesG} lipides={preview.lipidesG} />
              <Text style={s.historyMeta}>Estimation ; le journal affichera les valeurs confirmées après synchronisation.</Text>
            </View>
          )}

          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button
            title={busy ? "Ajout en cours…" : `Ajouter ${mealTarget[meal]}${preview ? ` · ${formatNutrition(preview.caloriesKcal)} kcal` : ""}`}
            onPress={() => void submit()}
            disabled={busy}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
