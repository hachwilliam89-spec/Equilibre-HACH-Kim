import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { useLogout } from "../auth/useLogout";
import { Button } from "../plans/ui";
import { getProfile, updateIdentity } from "../profile/api";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import { getCoachAccount, updateCoachIdentity } from "./api";
import { hasIdentity, identitySchema, type Person } from "./identity";
import { IdentityFields } from "./IdentityFields";
import { useIdentity } from "./store";

type Role = "utilisateur" | "coach";

async function loadIdentity(role: Role): Promise<{ me: Person; coach: Person | null }> {
  if (role === "coach") return { me: await getCoachAccount(), coach: null };
  const profile = await getProfile();
  return { me: profile, coach: profile.coach };
}

/**
 * Charge l'identité du compte connecté. Un ancien compte sans prénom ni nom
 * doit la compléter avant de continuer. Hors ligne, l'application reste
 * utilisable : la vérification sera refaite à la prochaine ouverture.
 */
export function IdentityGate({ role, userId, children }: { role: Role; userId: string; children: ReactNode }) {
  const me = useIdentity((state) => state.me);
  // Compte dont l'identité manque (vérifiée côté serveur) ; null = rien à compléter.
  const [missingFor, setMissingFor] = useState<string | null>(null);
  const missing = missingFor === userId;

  useEffect(() => {
    let active = true;
    useIdentity.getState().reset();
    void loadIdentity(role)
      .then(({ me: loaded, coach }) => {
        if (!active) return;
        useIdentity.setState({ me: loaded, coach });
        setMissingFor(hasIdentity(loaded) ? null : userId);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [role, userId]);

  return (
    <>
      {children}
      <Modal visible={missing} animationType="slide" transparent onRequestClose={() => undefined}>
        <CompleteIdentity
          role={role}
          initial={me}
          onDone={(updated) => {
            useIdentity.getState().setMe(updated);
            setMissingFor(null);
          }}
        />
      </Modal>
    </>
  );
}

function CompleteIdentity({ role, initial, onDone }: {
  role: Role;
  initial: Person | null;
  onDone: (me: Person) => void;
}) {
  const [prenom, setPrenom] = useState(initial?.prenom ?? "");
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const { prepare, leave } = useLogout();

  const submit = async () => {
    if (pending.current) return;
    const parsed = identitySchema.safeParse({ prenom, nom });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      onDone(role === "coach" ? await updateCoachIdentity(parsed.data) : await updateIdentity(parsed.data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible. Réessaie.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0a2a2066", justifyContent: "flex-end" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: colors.page, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}
        >
          <Text accessibilityRole="header" style={s.cardTitle}>Complétez votre profil</Text>
          <Text style={s.text}>
            {role === "coach"
              ? "Vos utilisateurs verront votre prénom et votre nom plutôt que votre adresse e-mail."
              : "Votre coach vous retrouvera par votre prénom et votre nom plutôt que par votre adresse e-mail."}
          </Text>
          <IdentityFields prenom={prenom} nom={nom} onPrenom={setPrenom} onNom={setNom} disabled={saving} />
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <Button title={saving ? "Enregistrement…" : "Continuer"} disabled={saving} onPress={() => void submit()} />
          <Button
            title="Se déconnecter"
            variant="ghost"
            disabled={saving}
            onPress={() => void prepare().then(() => leave())}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
