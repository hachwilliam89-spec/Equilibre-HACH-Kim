import { router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode, Ref } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Brand } from "../ui/Brand";
import { ChevronLeft } from "../ui/icons";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";

type ScreenProps = {
  children: ReactNode;
  scrollRef?: Ref<ScrollView>;
  /** Titre de l'écran : bandeau vert (écran racine) ou barre de retour (`back`). */
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  /** Écran secondaire : barre avec flèche retour. Repli si l'historique est vide. */
  back?: Href;
  /** Logo complet (écran de connexion, chargement de session). */
  brand?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Élément flottant hors défilement (bouton d'action). */
  floating?: ReactNode;
  /** Sous une barre d'onglets : la marge basse est déjà gérée par la barre. */
  inTabs?: boolean;
};

export function Screen({
  children,
  scrollRef,
  title,
  eyebrow,
  subtitle,
  back,
  brand = false,
  refreshing = false,
  onRefresh,
  floating,
  inTabs = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const hero = !!title && !back;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (back) router.replace(back);
  };
  return (
    <View style={s.page}>
      <StatusBar style={hero ? "light" : "dark"} />
      <View style={{ height: insets.top, backgroundColor: hero ? colors.brandDeep : colors.page }} />
      {back && (
        <View style={s.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={goBack}
            style={({ pressed }) => [s.backButton, pressed && { backgroundColor: colors.mint }]}
          >
            <ChevronLeft color={colors.brand} size={26} strokeWidth={2.4} />
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} style={s.topBarTitle}>
            {title}
          </Text>
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: (inTabs ? 24 : insets.bottom + 24) + (floating ? 72 : 0) }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={hero ? colors.onBrand : colors.brand}
                colors={[colors.brand]}
                progressBackgroundColor={colors.card}
              />
            ) : undefined
          }
        >
          {hero && (
            <View style={s.hero}>
              <View style={s.heroHalo} />
              <View style={s.heroInner}>
                {!!eyebrow && <Text style={s.heroEyebrow}>{eyebrow}</Text>}
                <Text accessibilityRole="header" style={s.heroTitle}>{title}</Text>
                {!!subtitle && <Text style={s.heroSubtitle}>{subtitle}</Text>}
              </View>
            </View>
          )}
          <View style={[s.content, hero && { paddingTop: 0, marginTop: -28 }]}>
            {brand && <Brand />}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {floating}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === "secondary" && s.buttonSecondary,
        variant === "ghost" && s.buttonGhost,
        variant === "danger" && s.buttonDanger,
        pressed && { opacity: 0.85 },
        disabled && s.disabled,
      ]}
    >
      {icon}
      <Text
        style={[
          s.buttonText,
          (variant === "secondary" || variant === "ghost") && { color: colors.brand },
          variant === "danger" && { color: colors.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, error, numeric = false, disabled = false }: { label: string; value: string; onChange: (s: string) => void; error?: string; numeric?: boolean; disabled?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, disabled && s.inputDisabled]} value={value} onChangeText={onChange} keyboardType={numeric ? "decimal-pad" : "default"} autoCapitalize="none" editable={!disabled} />{error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}</View>;
}

/** Valeur courte affichée en ligne (libellé à gauche, valeur à droite). */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.text}>{label}</Text>
      <Text style={[s.label, { textAlign: "right", flexShrink: 1 }]}>{value}</Text>
    </View>
  );
}
