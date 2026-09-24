import type { ReactNode } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../plans/ui";
import { styles as s } from "./styles";

export function PickerSheet({ visible, title, onCancel, onConfirm, children }: {
  visible: boolean; title: string; onCancel: () => void; onConfirm: () => void; children: ReactNode;
}) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000066" }}>
      <SafeAreaView edges={["bottom", "left", "right"]} style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text accessibilityRole="header" style={s.label}>{title}</Text>
          {children}
          <Button title="Valider" onPress={onConfirm} />
          <Button title="Annuler" onPress={onCancel} />
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
