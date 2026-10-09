import { Alert, Platform, Pressable, Text } from "react-native";
import type { AccountActionTone } from "../ui/accountAction";
import { LogoutIcon } from "../ui/icons";
import { colors } from "../ui/theme";
import { logoutMessage, useLogout } from "./useLogout";

/**
 * Bouton de déconnexion de la barre fixe : visible sur chaque écran connecté,
 * avec une confirmation qui prévient des modifications non envoyées.
 */
export function LogoutButton({ tone = "onBrand" }: { tone?: AccountActionTone }) {
  const { prepare, leave, busy } = useLogout();
  const onBrand = tone === "onBrand";
  const foreground = onBrand ? colors.onBrand : colors.brand;

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
        backgroundColor: onBrand
          ? pressed ? "#ffffff33" : "#ffffff1f"
          : pressed ? colors.mint : colors.mintSoft,
        opacity: busy ? 0.6 : 1,
      })}
    >
      <LogoutIcon size={18} color={foreground} />
      <Text style={{ color: foreground, fontSize: 13, fontWeight: "700" }}>
        {busy ? "…" : "Déconnexion"}
      </Text>
    </Pressable>
  );
}

/** Rendu fourni aux écrans connectés via `AccountActionContext`. */
export function renderLogoutButton(tone: AccountActionTone) {
  return <LogoutButton tone={tone} />;
}
