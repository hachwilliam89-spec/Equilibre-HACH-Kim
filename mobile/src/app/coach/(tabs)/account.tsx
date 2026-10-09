import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSession } from "../../../auth/session";
import { getCoachAccount, updateCoachIdentity, type CoachAccount } from "../../../identity/api";
import { identitySchema } from "../../../identity/identity";
import { IdentityFields } from "../../../identity/IdentityFields";
import { useIdentity } from "../../../identity/store";
import { Button, InfoRow, Screen } from "../../../plans/ui";
import { styles as s } from "../../../ui/styles";
import { colors } from "../../../ui/theme";

export default function CoachAccountScreen() {
  const session = useSession((state) => state.session);
  const [account, setAccount] = useState<CoachAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const pending = useRef(false);
  const coachCode = account?.coachCode ?? (session?.role === "coach" ? session.coachCode : undefined);

  const apply = (next: CoachAccount) => {
    setAccount(next);
    setPrenom(next.prenom ?? "");
    setNom(next.nom ?? "");
    useIdentity.getState().setMe(next);
  };

  useEffect(() => {
    let active = true;
    void getCoachAccount()
      .then((next) => { if (active) apply(next); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Impossible de charger votre compte.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async () => {
    if (pending.current) return;
    const parsed = identitySchema.safeParse({ prenom, nom });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setNotice("");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      apply(await updateCoachIdentity(parsed.data));
      setNotice("Identité enregistrée.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible. Réessaie.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

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
        ) : loading ? (
          <ActivityIndicator color={colors.brand} accessibilityLabel="Chargement du code coach" />
        ) : (
          <Text style={s.text}>Déconnectez-vous puis reconnectez-vous pour obtenir votre code.</Text>
        )}
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Mon identité</Text>
        {loading ? (
          <ActivityIndicator color={colors.brand} accessibilityLabel="Chargement du compte" />
        ) : (
          <>
            {account && <InfoRow label="E-mail" value={account.email} />}
            <Text style={s.historyMeta}>Vos utilisateurs voient votre prénom et votre nom.</Text>
            <IdentityFields prenom={prenom} nom={nom} onPrenom={setPrenom} onNom={setNom} disabled={saving || !account} />
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            {!!notice && <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
            <Button
              title={saving ? "Enregistrement…" : "Enregistrer"}
              disabled={saving || !account}
              onPress={() => void save()}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
