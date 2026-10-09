import { Alert, Platform, Pressable, Text } from "react-native";
import { LogoutIcon } from "../ui/icons";
import { colors } from "../ui/theme";
import { logoutMessage, useLogout } from "./useLogout";

/**
 * Bouton de déconnexion du bandeau : toujours visible en haut de l'écran,
 * avec une confirmation qui prévient des modifications non envoyées.
 */
export function LogoutButton() {
  const { prepare, leave, busy } = useLogout();

  const press = async () => {
    const pending = await prepare();
    const title = pending ? "Modifications non envoyées" : "Se déconnecter ?";
    const message = logoutMessage(pending);
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`${title}\n\n${message}`)) await leave();
      return;
    }
    Alert.alert(title, message, [
      { text: "Annuler", style: "cancel" },
      { text: pending ? "Se déconnecter quand même" : "Se déconnecter", style: "destructive", onPress: () => void leave() },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Se déconnecter"
      disabled={busy}
      onPress={() => void press()}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: pressed ? "#ffffff33" : "#ffffff1f",
        opacity: busy ? 0.6 : 1,
      })}
    >
      <LogoutIcon size={18} color={colors.onBrand} />
      <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>
        {busy ? "…" : "Déconnexion"}
      </Text>
    </Pressable>
  );
}
