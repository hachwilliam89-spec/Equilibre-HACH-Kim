import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import {
  addFoodEntry,
  searchReferenceFoods,
  type MealCategory,
  type ReferenceFood,
} from "../../nutrition/api";
import {
  formatNutrition,
  mealCategories,
  nutritionForQuantity,
  parseFoodQuantity,
} from "../../nutrition/presentation";
import { Button, Field, Screen } from "../../plans/ui";
import { styles as s } from "../../ui/styles";

export default function AddFoodScreen() {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<ReferenceFood[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [searchNonce, setSearchNonce] = useState(0);
  const [selected, setSelected] = useState<ReferenceFood | null>(null);
  const [quantityText, setQuantityText] = useState("");
  const [mealCategory, setMealCategory] = useState<MealCategory | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void searchReferenceFoods(query)
        .then((result) => {
          if (active) setFoods(result);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setSearchError(
            cause instanceof Error
              ? cause.message
              : "Impossible de rechercher les aliments.",
          );
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, searchNonce]);

  const quantity = parseFoodQuantity(quantityText);
  const preview = selected && quantity !== null
    ? nutritionForQuantity(selected, quantity)
    : null;

  const changeQuery = (value: string) => {
    setQuery(value);
    setSearching(true);
    setSearchError("");
    setFoods([]);
    setSelected(null);
    setQuantityText("");
    setSubmitError("");
  };

  const retrySearch = () => {
    setSearching(true);
    setSearchError("");
    setSearchNonce((value) => value + 1);
  };

  const submit = async () => {
    if (submitInFlight.current) return;
    if (!selected) {
      setSubmitError("Choisissez un aliment dans la liste.");
      return;
    }
    if (quantity === null) {
      setSubmitError("Saisissez une quantité supérieure à 0 g et au plus égale à 10 000 g.");
      return;
    }
    if (mealCategory === null) {
      setSubmitError("Choisissez le repas associé à cet aliment.");
      return;
    }
    submitInFlight.current = true;
    setBusy(true);
    setSubmitError("");
    try {
      await addFoodEntry(selected.id, quantity, mealCategory);
      router.replace("/user/journal");
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? `${cause.message} Vérifiez votre journal avant de réessayer.`
          : "Ajout impossible. Vérifiez votre journal avant de réessayer.",
      );
    } finally {
      submitInFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View>
        <Text style={s.eyebrow}>ESPACE UTILISATEUR</Text>
        <Text style={s.title}>Ajouter un aliment</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Bibliothèque de référence</Text>
        <Text style={s.text}>Recherchez un aliment par nom, puis choisissez sa quantité consommée.</Text>
        <Text style={s.label}>Nom de l’aliment</Text>
        <TextInput
          accessibilityLabel="Rechercher un aliment par nom"
          style={s.input}
          value={query}
          onChangeText={changeQuery}
          placeholder="Ex. riz blanc cuit"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
          editable={!busy}
        />
        {searching ? (
          <ActivityIndicator color="#087454" accessibilityLabel="Recherche des aliments" />
        ) : searchError ? (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" style={s.error}>{searchError}</Text>
            <Button title="Réessayer la recherche" onPress={retrySearch} />
          </View>
        ) : foods.length === 0 ? (
          <Text style={s.text}>Aucun aliment trouvé. Essayez un autre nom.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {foods.map((food) => (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selected?.id === food.id }}
                onPress={() => {
                  setSelected(food);
                  setQuantityText("");
                  setSubmitError("");
                }}
                disabled={busy}
                style={[s.choice, selected?.id === food.id && s.choiceSelected]}
              >
                <Text style={s.label}>{food.nom}</Text>
                <Text style={s.historyMeta}>
                  {formatNutrition(food.caloriesKcalPour100g)} kcal / 100 g
                </Text>
              </Pressable>
            ))}
            {foods.length === 20 && (
              <Text style={s.historyMeta}>20 premiers résultats. Précisez le nom pour affiner.</Text>
            )}
          </View>
        )}
      </View>

      {selected && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{selected.nom}</Text>
          <Text style={s.historyMeta}>
            Pour 100 g : {formatNutrition(selected.caloriesKcalPour100g)} kcal ·
            P {formatNutrition(selected.proteinesGPour100g)} g ·
            G {formatNutrition(selected.glucidesGPour100g)} g ·
            L {formatNutrition(selected.lipidesGPour100g)} g
          </Text>
          <Field
            label="Quantité consommée (g)"
            value={quantityText}
            onChange={(value) => {
              setQuantityText(value);
              setSubmitError("");
            }}
            numeric
            disabled={busy}
          />
          <Text style={s.label}>Repas</Text>
          <Text style={s.historyMeta}>Ce choix organise le journal ; le budget reste celui de la journée.</Text>
          <View style={s.choiceRow}>
            {mealCategories.map(({ value, label }) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: mealCategory === value }}
                disabled={busy}
                onPress={() => {
                  setMealCategory(value);
                  setSubmitError("");
                }}
                style={[
                  s.choice,
                  { flexGrow: 1, minWidth: 100, alignItems: "center" },
                  mealCategory === value && s.choiceSelected,
                ]}
              >
                <Text style={s.label}>
                  {value === "petit-dejeuner" ? "Petit-déj." : label}
                </Text>
              </Pressable>
            ))}
          </View>
          {preview && (
            <View style={{ gap: 5 }}>
              <Text style={s.label}>Pour {formatNutrition(quantity!)} g</Text>
              <Text style={s.metricValue}>{formatNutrition(preview.caloriesKcal)} kcal</Text>
              <Text style={s.historyMeta}>
                Protéines {formatNutrition(preview.proteinesG)} g · Glucides {formatNutrition(preview.glucidesG)} g · Lipides {formatNutrition(preview.lipidesG)} g
              </Text>
              <Text style={s.historyMeta}>Estimation ; le journal affichera les valeurs enregistrées par le serveur.</Text>
            </View>
          )}
          {!!submitError && <Text accessibilityRole="alert" style={s.error}>{submitError}</Text>}
          <Button title={busy ? "Ajout en cours…" : "Ajouter au journal"} onPress={() => void submit()} disabled={busy} />
        </View>
      )}

      <Button title="Retour au journal" onPress={() => router.replace("/user/journal")} disabled={busy} />
    </Screen>
  );
}
