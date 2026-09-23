import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "../ui/Brand";
import { styles as s } from "../ui/styles";
export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={s.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { justifyContent: "flex-start" }]}><Brand />{children}</ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
export function Field({ label, value, onChange, error, numeric = false, disabled = false }: { label: string; value: string; onChange: (s: string) => void; error?: string; numeric?: boolean; disabled?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChange} keyboardType={numeric ? "decimal-pad" : "default"} autoCapitalize="none" editable={!disabled} />{error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}</View>;
}
