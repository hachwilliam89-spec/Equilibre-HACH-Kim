import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import {
  addFoodEntry, getFavoriteFoods, searchReferenceFoods, setFavoriteFood,
  type FoodCategory, type MealCategory, type ReferenceFood,
} from "../../nutrition/api";
import {
  foodCategories, formatNutrition, mealCategories,
  nutritionForQuantity, parseFoodQuantity,
} from "../../nutrition/presentation";
import { FoodIcon } from "../../nutrition/FoodIcon";
import { foodIconKind, categoryIconKind } from "../../nutrition/food-icon-kind";
import { MacroBreakdown } from "../../nutrition/MacroBreakdown";
import { Button, Field, Screen } from "../../plans/ui";
import { styles as s } from "../../ui/styles";

type LibraryCategory = FoodCategory | "tous" | "favoris";
const PAGE_SIZE = 50;
const normalize = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");

export default function AddFoodScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LibraryCategory>("tous");
  const [foods, setFoods] = useState<ReferenceFood[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<ReferenceFood[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesNonce, setFavoritesNonce] = useState(0);
  const [favoritesBusyId, setFavoritesBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const [selected, setSelected] = useState<ReferenceFood | null>(null);
  const [quantityText, setQuantityText] = useState("");
  const [mealCategory, setMealCategory] = useState<MealCategory | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const submitInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void getFavoriteFoods()
      .then((result) => { if (active) setFavoriteFoods(result); })
      .catch((cause: unknown) => {
        if (active) setFavoriteError(cause instanceof Error ? cause.message : "Favoris indisponibles.");
      })
      .finally(() => { if (active) setFavoritesLoading(false); });
    return () => { active = false; };
  }, [favoritesNonce]);

  useEffect(() => {
    if (category === "favoris") return;
    let active = true;
    const timer = setTimeout(() => {
      void searchReferenceFoods(query, category === "tous" ? undefined : category, page)
        .then((result) => {
          if (!active) return;
          setFoods((previous) => page === 1 ? result : [...previous, ...result]);
          setHasMore(result.length === PAGE_SIZE);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setSearchError(cause instanceof Error ? cause.message : "Impossible de charger les aliments.");
        })
        .finally(() => { if (active) setSearching(false); });
    }, page === 1 ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, category, page, searchNonce]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setPage(1);
    setFoods([]);
    if (category !== "favoris") setSearching(true);
    setSearchError("");
    setSuccess("");
  };

  const changeCategory = (value: LibraryCategory) => {
    setCategory(value);
    setPage(1);
    setFoods([]);
    if (value !== "favoris") setSearching(true);
    setSearchError("");
    setSuccess("");
  };

  const favoriteIds = new Set(favoriteFoods.map((food) => food.id));
  const visibleFoods = category === "favoris"
    ? favoriteFoods.filter((food) => normalize(food.nom).includes(normalize(query.trim())))
    : foods;
  const quantity = parseFoodQuantity(quantityText);
  const preview = selected && quantity !== null
    ? nutritionForQuantity(selected, quantity)
    : null;

  const toggleFavorite = async (food: ReferenceFood) => {
    if (favoritesBusyId) return;
    const isFavorite = favoriteIds.has(food.id);
    setFavoritesBusyId(food.id);
    setFavoriteError("");
    try {
      await setFavoriteFood(food.id, !isFavorite);
      setFavoriteFoods((previous) => isFavorite
        ? previous.filter((item) => item.id !== food.id)
        : [...previous, food].sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
    } catch (cause) {
      setFavoriteError(cause instanceof Error ? cause.message : "Impossible de modifier le favori.");
    } finally {
      setFavoritesBusyId(null);
    }
  };

  const openFood = (food: ReferenceFood) => {
    Keyboard.dismiss();
    setSelected(food);
    setQuantityText("");
    setMealCategory(null);
    setSubmitError("");
    setSuccess("");
  };

  const submit = async () => {
    if (submitInFlight.current || !selected) return;
    if (quantity === null) {
      setSubmitError("Saisissez une quantité supérieure à 0 g et au plus égale à 10 000 g.");
      return;
    }
    if (!mealCategory) {
      setSubmitError("Choisissez le repas associé à cet aliment.");
      return;
    }
    submitInFlight.current = true;
    setBusy(true);
    setSubmitError("");
    try {
      await addFoodEntry(selected.id, quantity, mealCategory);
      setSuccess(`${selected.nom} ajouté au journal. Vous pouvez choisir un autre aliment.`);
      setSelected(null);
      setQuantityText("");
      setMealCategory(null);
    } catch (cause) {
      setSubmitError(cause instanceof Error
        ? `${cause.message} Vérifiez votre journal avant de réessayer.`
        : "Ajout impossible. Vérifiez votre journal avant de réessayer.");
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
        <Text style={s.cardTitle}>Bibliothèque alimentaire</Text>
        <Text style={s.text}>Parcourez les familles ou recherchez un aliment. Les valeurs sont indiquées pour 100 g.</Text>
        <TextInput
          accessibilityLabel="Rechercher un aliment par nom"
          style={s.input}
          value={query}
          onChangeText={changeQuery}
          placeholder="Ex. fromage blanc, yaourt…"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {[
            { value: "tous" as const, label: "Tous" },
            { value: "favoris" as const, label: "★ Favoris" },
            ...foodCategories,
          ].map(({ value, label }) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: category === value }}
              onPress={() => changeCategory(value)}
              style={[s.choice, { flexDirection: "row", alignItems: "center", gap: 6 }, category === value && s.choiceSelected]}
            >
              {value !== "tous" && value !== "favoris" && (
                <FoodIcon kind={categoryIconKind[value]} size={22} boxed={false} />
              )}
              <Text style={s.label}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {!!success && <Text accessibilityRole="alert" style={s.success}>{success}</Text>}
        {!!favoriteError && (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" style={s.error}>{favoriteError}</Text>
            <Button title="Réessayer les favoris" onPress={() => {
              setFavoriteError("");
              setFavoritesLoading(true);
              setFavoritesNonce((value) => value + 1);
            }} />
          </View>
        )}
        {category === "favoris" && favoritesLoading ? (
          <ActivityIndicator color="#087454" accessibilityLabel="Chargement des favoris" />
        ) : category !== "favoris" && searching && page === 1 ? (
          <ActivityIndicator color="#087454" accessibilityLabel="Chargement des aliments" />
        ) : searchError ? (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" style={s.error}>{searchError}</Text>
            <Button title="Réessayer" onPress={() => { setSearchError(""); setSearching(true); setSearchNonce((value) => value + 1); }} />
          </View>
        ) : visibleFoods.length === 0 ? (
          <Text style={s.text}>{category === "favoris"
            ? "Aucun favori ici. Touchez l’étoile d’un aliment pour le retrouver rapidement."
            : "Aucun aliment trouvé. Essayez une autre recherche ou une autre famille."}</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {visibleFoods.map((food) => (
              <View key={food.id} style={[s.choice, { flexDirection: "row", alignItems: "center", gap: 8, padding: 0 }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Choisir ${food.nom}`}
                  onPress={() => openFood(food)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}
                >
                  <FoodIcon kind={foodIconKind(food.nom, food.categorie)} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>{food.nom}</Text>
                    <Text style={s.historyMeta}>{formatNutrition(food.caloriesKcalPour100g)} kcal / 100 g</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${favoriteIds.has(food.id) ? "Retirer" : "Ajouter"} ${food.nom} ${favoriteIds.has(food.id) ? "des" : "aux"} favoris`}
                  accessibilityState={{ selected: favoriteIds.has(food.id), disabled: favoritesLoading || Boolean(favoritesBusyId) }}
                  disabled={favoritesLoading || Boolean(favoritesBusyId)}
                  onPress={() => void toggleFavorite(food)}
                  style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 25, color: favoriteIds.has(food.id) ? "#b36b00" : "#63756b" }}>
                    {favoritesBusyId === food.id ? "…" : favoriteIds.has(food.id) ? "★" : "☆"}
                  </Text>
                </Pressable>
              </View>
            ))}
            {category !== "favoris" && hasMore && (
              <Button title={searching ? "Chargement…" : "Voir plus d’aliments"} disabled={searching} onPress={() => { setSearching(true); setPage((value) => value + 1); }} />
            )}
          </View>
        )}
      </View>

      <Button title="Voir mon journal" onPress={() => router.replace("/user/journal")} disabled={busy} />

      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!busy) setSelected(null); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0008" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
              <View style={s.summaryRow}>
                <Text style={[s.cardTitle, { flex: 1 }]}>{selected?.nom}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Fermer" disabled={busy} onPress={() => setSelected(null)}>
                  <Text style={s.link}>Fermer</Text>
                </Pressable>
              </View>
              {!!selected && (
                <View style={{ gap: 8 }}>
                  <Text style={s.historyMeta}>Pour 100 g · {formatNutrition(selected.caloriesKcalPour100g)} kcal</Text>
                  <MacroBreakdown
                    proteines={selected.proteinesGPour100g}
                    glucides={selected.glucidesGPour100g}
                    lipides={selected.lipidesGPour100g}
                  />
                </View>
              )}
              <Field
                label="Quantité consommée (g)"
                value={quantityText}
                onChange={(value) => { setQuantityText(value); setSubmitError(""); }}
                numeric disabled={busy}
              />
              <Text style={s.label}>Repas</Text>
              <Text style={s.historyMeta}>Le repas organise le journal ; le budget reste celui de la journée.</Text>
              <View style={s.choiceRow}>
                {mealCategories.map(({ value, label }) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: mealCategory === value }}
                    disabled={busy}
                    onPress={() => { setMealCategory(value); setSubmitError(""); }}
                    style={[s.choice, { flexGrow: 1, minWidth: 100, alignItems: "center" }, mealCategory === value && s.choiceSelected]}
                  >
                    <Text style={s.label}>{value === "petit-dejeuner" ? "Petit-déj." : label}</Text>
                  </Pressable>
                ))}
              </View>
              {preview && (
                <View style={{ gap: 5 }}>
                  <Text style={s.label}>Pour {formatNutrition(quantity!)} g</Text>
                  <Text style={s.metricValue}>{formatNutrition(preview.caloriesKcal)} kcal</Text>
                  <MacroBreakdown
                    proteines={preview.proteinesG}
                    glucides={preview.glucidesG}
                    lipides={preview.lipidesG}
                  />
                  <Text style={s.historyMeta}>Estimation ; le journal affichera les valeurs enregistrées par le serveur.</Text>
                </View>
              )}
              {!!submitError && <Text accessibilityRole="alert" style={s.error}>{submitError}</Text>}
              <Button title={busy ? "Ajout en cours…" : "Ajouter au journal"} onPress={() => void submit()} disabled={busy} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}
