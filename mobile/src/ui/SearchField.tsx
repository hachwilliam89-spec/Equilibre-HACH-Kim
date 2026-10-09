import { Pressable, TextInput, View } from "react-native";
import { CloseIcon, SearchIcon } from "./icons";
import { colors } from "./theme";

/** Champ de recherche arrondi avec bouton d'effacement. */
export function SearchField({ value, onChange, placeholder, accessibilityLabel }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}) {
  return (
    <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", height: 50, borderRadius: 25, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong, gap: 8 }}>
      <SearchIcon size={20} color={colors.muted} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        style={{ flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 0 }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        maxLength={100}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
          onPress={() => onChange("")}
          hitSlop={8}
          style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint }}
        >
          <CloseIcon size={14} color={colors.brand} strokeWidth={2.6} />
        </Pressable>
      )}
    </View>
  );
}
