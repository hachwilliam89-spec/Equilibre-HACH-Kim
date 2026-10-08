import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Text, View } from "react-native";
import { LogoutCard } from "../../../auth/LogoutCard";
import { useSession } from "../../../auth/session";
import { Button, Screen } from "../../../plans/ui";
import { styles as s } from "../../../ui/styles";
import { colors } from "../../../ui/theme";

export default function CoachAccount() {
  const session = useSession((state) => state.session);
  const coachCode = session?.role === "coach" ? session.coachCode : undefined;
  const [copyStatus, setCopyStatus] = useState("");

  const copy = async () => {
    if (!coachCode) return;
    try {
      const copied = await Clipboard.setStringAsync(coachCode);
      setCopyStatus(copied ? "Code copié." : "Copie impossible. Sélectionnez le code pour le copier.");
    } catch {
      setCopyStatus("Copie impossible. Sélectionnez le code pour le copier.");
    }
  };

  return (
    <Screen inTabs eyebrow="ESPACE COACH" title="Mon compte">
      <View style={[s.card, { backgroundColor: colors.mintSoft, borderColor: colors.mint }]}>
        <Text style={s.metricLabel}>Mon code coach</Text>
        {coachCode ? (
          <>
            <Text selectable style={{ fontSize: 34, fontWeight: "800", color: colors.brandDeep, letterSpacing: 1 }}>
              {coachCode}
            </Text>
            <Text style={s.text}>Transmettez ce code à votre utilisateur pour son inscription.</Text>
            <Button title="Copier mon code" variant="secondary" onPress={() => void copy()} />
            {!!copyStatus && <Text accessibilityLiveRegion="polite" style={s.success}>{copyStatus}</Text>}
          </>
        ) : (
          <Text style={s.text}>Déconnectez-vous puis reconnectez-vous pour obtenir votre code.</Text>
        )}
      </View>
      <LogoutCard />
    </Screen>
  );
}
