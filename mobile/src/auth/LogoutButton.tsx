import { Pressable, Text } from "react-native";
import { confirmAction } from "../ui/confirmStore";
import type { AccountActionTone } from "../ui/accountAction";
import { AlertIcon, LogoutIcon } from "../ui/icons";
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
    const confirmed = await confirmAction({
      title: pending ? "Modifications non envoyées" : "Se déconnecter ?",
      message: logoutMessage(pending),
      confirmLabel: pending ? "Se déconnecter quand même" : "Se déconnecter",
      tone: pending ? "danger" : "brand",
      icon: pending ? AlertIcon : LogoutIcon,
    });
    if (!confirmed) return;
    const failure = await leave();
    if (failure) {
      await confirmAction({
        title: "Déconnexion impossible",
        message: failure,
        confirmLabel: "Compris",
        cancelLabel: null,
        tone: "danger",
        icon: AlertIcon,
      });
    }
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
