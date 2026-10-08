import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { StarIcon } from "../ui/icons";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import type { ReferenceFood } from "./api";
import { FoodIcon } from "./FoodIcon";
import { foodIconKind } from "./food-icon-kind";
import { formatNutrition } from "./presentation";

/** Ligne de la bibliothèque : valeurs pour 100 g, choix et favori. */
export const FoodRow = memo(function FoodRow({
  food,
  favorite,
  favoriteBusy,
  favoritesLocked,
  onChoose,
  onToggleFavorite,
}: {
  food: ReferenceFood;
  favorite: boolean;
  favoriteBusy: boolean;
  favoritesLocked: boolean;
  onChoose: (food: ReferenceFood) => void;
  onToggleFavorite: (food: ReferenceFood) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choisir ${food.nom}`}
        onPress={() => onChoose(food)}
        style={({ pressed }) => [
          { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 12, paddingVertical: 10, borderRadius: 16 },
          pressed && { backgroundColor: colors.mintSoft },
        ]}
      >
        <FoodIcon kind={foodIconKind(food.nom, food.categorie)} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={s.label}>{food.nom}</Text>
          <Text style={s.historyMeta}>
            <Text style={{ fontWeight: "700", color: colors.ink }}>
              {formatNutrition(food.caloriesKcalPour100g)} kcal
            </Text>
            {"  ·  "}P {formatNutrition(food.proteinesGPour100g)} · G {formatNutrition(food.glucidesGPour100g)} · L {formatNutrition(food.lipidesGPour100g)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${favorite ? "Retirer" : "Ajouter"} ${food.nom} ${favorite ? "des" : "aux"} favoris`}
        accessibilityState={{ selected: favorite, disabled: favoritesLocked }}
        disabled={favoritesLocked}
        onPress={() => onToggleFavorite(food)}
        hitSlop={4}
        style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", opacity: favoriteBusy ? 0.4 : 1 }}
      >
        <StarIcon filled={favorite} color={favorite ? "#c2881c" : colors.subtle} size={24} />
      </Pressable>
    </View>
  );
});
