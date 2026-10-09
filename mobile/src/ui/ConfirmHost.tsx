import { Modal, Pressable, Text, View } from "react-native";
import { Button } from "../plans/ui";
import { useConfirm } from "./confirmStore";
import { styles as s } from "./styles";
import { colors, radius } from "./theme";

/** Rendu unique de la fenêtre de confirmation, monté à la racine de l'application. */
export function ConfirmHost() {
  const current = useConfirm((state) => state.current);
  const answer = useConfirm((state) => state.answer);
  const danger = current?.tone === "danger";
  const Icon = current?.icon;
  const dismiss = () => answer(false);

  return (
    <Modal visible={current !== null} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer la fenêtre"
          onPress={dismiss}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0a2a2073" }}
        />
        {current && (
          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: 24,
              gap: 14,
              width: "100%",
              maxWidth: 420,
              alignSelf: "center",
              shadowColor: "#0a2a20",
              shadowOpacity: 0.18,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            {Icon && (
              <View style={{
                width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
                backgroundColor: danger ? "#fbecea" : colors.mint,
              }}>
                <Icon size={26} color={danger ? colors.danger : colors.brand} strokeWidth={2.2} />
              </View>
            )}
            <Text accessibilityRole="header" style={s.cardTitle}>{current.title}</Text>
            <Text style={s.text}>{current.message}</Text>
            <View style={{ gap: 10, marginTop: 6 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => answer(true)}
                style={({ pressed }) => [
                  s.button,
                  danger && { backgroundColor: colors.danger },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={s.buttonText}>{current.confirmLabel}</Text>
              </Pressable>
              {current.cancelLabel !== null && (
                <Button title={current.cancelLabel ?? "Annuler"} variant="ghost" onPress={dismiss} />
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
