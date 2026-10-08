import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "../../auth/api";
import { AddFoodSheet, mealTarget } from "../../nutrition/AddFoodSheet";
import {
  searchReferenceFoods,
  type FoodCategory, type MealCategory, type ReferenceFood,
} from "../../nutrition/api";
import { FoodIcon } from "../../nutrition/FoodIcon";
import { categoryIconKind } from "../../nutrition/food-icon-kind";
import { FoodRow } from "../../nutrition/FoodRow";
import { foodCategories, suggestedMeal } from "../../nutrition/presentation";
import { Button, Screen } from "../../plans/ui";
import { SyncStatus } from "../../sync/SyncStatus";
import { useSync } from "../../sync/useSync";
import { CheckIcon, ClockIcon, CloseIcon, SearchIcon, StarIcon } from "../../ui/icons";
import { styles as s } from "../../ui/styles";
import { colors } from "../../ui/theme";

type LibraryCategory = FoodCategory | "tous" | "favoris" | "recents";
type Meal = Exclude<MealCategory, "non-classe">;
const PAGE_SIZE = 50;
const normalize = (value: string) => value.normalize("NFD")
  .replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr-FR");
const isLocal = (category: LibraryCategory) => category === "favoris" || category === "recents";

type Source = "tous" | "recents" | "favoris";
const sources: { value: Source; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "recents", label: "Récents" },
  { value: "favoris", label: "Favoris" },
];

/** Ligne 1 : d'où viennent les aliments (catalogue, récents, favoris). */
function SourceTabs({ value, onChange }: { value: Source; onChange: (source: Source) => void }) {
  return (
    <View style={[s.tabs, { marginHorizontal: 16, padding: 3 }]} accessibilityRole="tablist">
      {sources.map((source) => {
        const selected = value === source.value;
        const tint = selected ? colors.onBrand : colors.muted;
        return (
          <Pressable
            key={source.value}
            accessibilityRole="tab"
            accessibilityLabel={source.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(source.value)}
            style={[s.tab, { minHeight: 40, flexDirection: "row", gap: 6 }, selected && s.tabSelected]}
          >
            {source.value === "recents" && <ClockIcon size={16} color={tint} />}
            {source.value === "favoris" && <StarIcon size={16} color={selected ? colors.onBrand : "#c2881c"} filled />}
            <Text style={[s.tabText, { fontSize: 14 }, selected && s.tabTextSelected]}>{source.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ligne 2 : familles du catalogue ; un second appui retire le filtre. */
function FamilyChip({ value, label, selected, onPress }: { value: FoodCategory; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
        selected && { backgroundColor: colors.mint, borderColor: colors.brand },
      ]}
    >
      <FoodIcon kind={categoryIconKind[value]} size={20} boxed={false} />
      <Text style={{ fontSize: 14, fontWeight: "700", color: selected ? colors.brand : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export default function AddFoodScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LibraryCategory>("tous");
  const [foods, setFoods] = useState<ReferenceFood[]>([]);
  // Favoris et récents viennent de la base embarquée : disponibles hors ligne.
  const favoriteFoods = useSync((state) => state.vue.favoris);
  const recentFoods = useSync((state) => state.vue.recents);
  const basculerFavori = useSync((state) => state.basculerFavori);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritesBusyId, setFavoritesBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const [selected, setSelected] = useState<ReferenceFood | null>(null);
  // Repas présélectionné selon l'heure, conservé pour les ajouts suivants.
  const [meal, setMeal] = useState<Meal>(() => suggestedMeal(new Date().getHours()));
  const [added, setAdded] = useState<{ nom: string; meal: Meal; count: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<ReferenceFood>>(null);

  useEffect(() => {
    if (isLocal(category)) return;
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
          // Le référentiel complet n'est pas copié sur l'appareil (strict nécessaire).
          setSearchError(cause instanceof ApiError
            ? cause.message
            : "Recherche indisponible hors ligne. Retrouvez vos aliments dans « Récents » ou « Favoris ».");
        })
        .finally(() => { if (active) setSearching(false); });
    }, page === 1 ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, category, page, searchNonce]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const resetResults = (nextCategory: LibraryCategory) => {
    setPage(1);
    setFoods([]);
    if (!isLocal(nextCategory)) setSearching(true);
    setSearchError("");
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    resetResults(category);
  };

  const changeCategory = (value: LibraryCategory) => {
    if (value === category) return;
    setCategory(value);
    resetResults(value);
  };

  const favoriteIds = new Set(favoriteFoods.map((food) => food.id));
  const visibleFoods = category === "favoris"
    ? favoriteFoods.filter((food) => normalize(food.nom).includes(normalize(query.trim())))
    : category === "recents"
      ? recentFoods.filter((food) => normalize(food.nom).includes(normalize(query.trim())))
      : foods;

  const toggleFavorite = useCallback(async (food: ReferenceFood) => {
    if (favoritesBusyId) return;
    const isFavorite = useSync.getState().vue.favoris.some((f) => f.id === food.id);
    setFavoritesBusyId(food.id);
    setFavoriteError("");
    try {
      await basculerFavori(food, !isFavorite);
    } catch {
      setFavoriteError("Impossible de modifier le favori sur l’appareil.");
    } finally {
      setFavoritesBusyId(null);
    }
  }, [basculerFavori, favoritesBusyId]);

  const chooseFood = useCallback((food: ReferenceFood) => {
    Keyboard.dismiss();
    setSelected(food);
  }, []);

  const onAdded = (food: ReferenceFood, addedMeal: Meal) => {
    setSelected(null);
    setAdded((previous) => ({ nom: food.nom, meal: addedMeal, count: (previous?.count ?? 0) + 1 }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setAdded((previous) => previous && { ...previous, nom: "" }), 5000);
  };

  const loadMore = () => {
    if (isLocal(category) || !hasMore || searching || searchError) return;
    setSearching(true);
    setPage((value) => value + 1);
  };

  const emptyMessage = category === "favoris"
    ? "Aucun favori ici. Touchez l’étoile d’un aliment pour le retrouver rapidement."
    : category === "recents"
      ? "Aucun aliment récent. Vos derniers ajouts apparaîtront ici."
      : query.trim()
        ? `Aucun aliment trouvé pour « ${query.trim()} ». Essayez un autre mot ou une autre famille.`
        : "Aucun aliment dans cette famille.";

  return (
    <Screen back="/user/journal" title="Ajouter un aliment" fixed>
      <View style={{ gap: 12, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.page, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", height: 50, borderRadius: 25, marginHorizontal: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong, gap: 8 }}>
          <SearchIcon size={20} color={colors.muted} />
          <TextInput
            accessibilityLabel="Rechercher un aliment par nom"
            style={{ flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 0 }}
            value={query}
            onChangeText={changeQuery}
            placeholder="Rechercher : yaourt, riz, pomme…"
            placeholderTextColor={colors.subtle}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              onPress={() => changeQuery("")}
              hitSlop={8}
              style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint }}
            >
              <CloseIcon size={14} color={colors.brand} strokeWidth={2.6} />
            </Pressable>
          )}
        </View>
        <SourceTabs
          value={isLocal(category) ? (category as Source) : "tous"}
          onChange={(source) => changeCategory(source)}
        />
        {!isLocal(category) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          >
            {foodCategories.map(({ value, label }) => (
              <FamilyChip
                key={value}
                value={value}
                label={label}
                selected={category === value}
                onPress={() => changeCategory(category === value ? "tous" : value)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={searchError || (searching && page === 1 && !isLocal(category)) ? [] : visibleFoods}
        keyExtractor={(food) => food.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + (added ? 96 : 24) }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <FoodRow
            food={item}
            favorite={favoriteIds.has(item.id)}
            favoriteBusy={favoritesBusyId === item.id}
            favoritesLocked={favoritesBusyId !== null}
            onChoose={chooseFood}
            onToggleFavorite={(food) => void toggleFavorite(food)}
          />
        )}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 4 }}>
            <SyncStatus />
            {!!favoriteError && <Text accessibilityRole="alert" style={s.error}>{favoriteError}</Text>}
            <Text style={s.historyMeta}>Valeurs pour 100 g · touchez un aliment pour choisir la quantité.</Text>
          </View>
        }
        ListEmptyComponent={
          !isLocal(category) && searching ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.brand} accessibilityLabel="Chargement des aliments" />
          ) : searchError ? (
            <View style={[s.card, { marginTop: 8 }]}>
              <Text accessibilityRole="alert" style={s.error}>{searchError}</Text>
              <Button title="Réessayer" onPress={() => { setSearchError(""); setSearching(true); setSearchNonce((value) => value + 1); }} />
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 32, paddingHorizontal: 12 }}>
              <SearchIcon size={36} color={colors.borderStrong} />
              <Text style={[s.text, { textAlign: "center" }]}>{emptyMessage}</Text>
            </View>
          )
        }
        ListFooterComponent={
          searching && page > 1 ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.brand} /> : null
        }
      />

      {added && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute", left: 16, right: 16, bottom: insets.bottom + 16,
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: colors.brandDeep, borderRadius: 18, paddingVertical: 12, paddingLeft: 14, paddingRight: 8,
            shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
          }}
        >
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandBright, alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={16} color={colors.onBrand} strokeWidth={3} />
          </View>
          <Text numberOfLines={2} style={{ flex: 1, color: colors.onBrand, fontSize: 14, fontWeight: "600" }}>
            {added.nom
              ? `${added.nom} ajouté ${mealTarget[added.meal]}`
              : `${added.count} aliment${added.count > 1 ? "s" : ""} ajouté${added.count > 1 ? "s" : ""}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir mon journal"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/user/journal"))}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#ffffff22" }}
          >
            <Text style={{ color: colors.onBrand, fontWeight: "800", fontSize: 14 }}>Journal</Text>
          </Pressable>
        </View>
      )}

      <AddFoodSheet
        food={selected}
        meal={meal}
        onMealChange={setMeal}
        onClose={() => setSelected(null)}
        onAdded={onAdded}
      />
    </Screen>
  );
}
