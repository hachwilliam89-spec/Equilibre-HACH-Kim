import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { register } from "./api";
import { registrationSchema } from "./contracts";
import { useSession } from "./session";
import { styles as s } from "../ui/styles";

export function RegistrationForm({ onRegistered, onBusyChange }: {
  onRegistered: (email: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"utilisateur" | "coach">("utilisateur");
  const [coachCode, setCoachCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (pending.current) return;
    const parsed = registrationSchema.safeParse({ email, password, role, coachCode });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await register(parsed.data);
      setPassword("");
      useSession.setState({ error: null });
      onRegistered(parsed.data.email);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Inscription impossible. Réessaie.");
    } finally { pending.current = false; setBusy(false); onBusyChange(false); }
  };
  return (
        <View style={s.card}>
          <Text style={s.label}>Adresse e-mail</Text>
          <TextInput accessibilityLabel="Adresse e-mail" style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
          <Text style={s.label}>Mot de passe</Text>
          <TextInput accessibilityLabel="Mot de passe" style={s.input} value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy} />
          <Pressable accessibilityRole="button" onPress={() => setVisible(!visible)}><Text style={s.link}>{visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}</Text></Pressable>
          <Text style={s.label}>Rôle</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {(["utilisateur", "coach"] as const).map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: role === choice }} disabled={busy} onPress={() => { setRole(choice); setError(null); }} style={[s.input, { flex: 1 }, role === choice && { backgroundColor: "#e4efea", borderColor: "#087454" }]}><Text style={s.label}>{choice === "coach" ? "Coach" : "Utilisateur"}</Text></Pressable>)}
          </View>
          {role === "utilisateur" && <>
            <Text style={s.label}>Code du coach</Text>
            <TextInput accessibilityLabel="Code du coach" style={s.input} value={coachCode} onChangeText={setCoachCode} autoCapitalize="none" autoCorrect={false} editable={!busy} />
            <Text style={s.text}>Saisissez le code transmis par votre coach.</Text>
          </>}
          {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} style={[s.button, busy && s.disabled]} onPress={submit}><Text style={s.buttonText}>{busy ? "Inscription…" : "Créer mon compte"}</Text></Pressable>
        </View>
  );
}
