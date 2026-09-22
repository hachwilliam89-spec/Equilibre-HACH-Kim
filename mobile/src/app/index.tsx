import { RegistrationForm } from "../auth/RegistrationForm";
import * as Clipboard from "expo-clipboard";
import { Brand } from "../ui/Brand";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { credentialsSchema } from "../auth/contracts";
import { useSession } from "../auth/session";
import { styles as s } from "../ui/styles";

export default function Connection() {
  const { session, ready, busy, error, restore, signIn, signOut } =
    useSession();
  const { auth } = useLocalSearchParams<{ auth?: string }>();
  const registering = auth === "inscription";
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const changeTab = (tab: "connexion" | "inscription") => {
    if (busy || registrationBusy) return;
    setValidation(null);
    setRegistered(false);
    setPassword("");
    setVisible(false);
    useSession.setState({ error: null });
    router.setParams({ auth: tab });
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [visible, setVisible] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  useEffect(() => {
    void restore();
  }, [restore]);
  const submit = async () => {
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setValidation(parsed.error.issues[0].message);
      return;
    }
    setValidation(null);
    await signIn(parsed.data);
    if (useSession.getState().session) {
      setPassword("");
      setVisible(false);
      setValidation(null);
    }
  };
  return (
    <SafeAreaView style={s.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <Brand />
          {!ready ? (
            <View style={s.card}>
              <Text style={s.title}>Retrouvons votre espace</Text>
              {busy && (
                <ActivityIndicator
                  color="#087454"
                  accessibilityLabel="Restauration de la session"
                />
              )}
              {error && (
                <>
                  <Text accessibilityRole="alert" style={s.error}>
                    {error}
                  </Text>
                  <Pressable
                    style={s.button}
                    disabled={busy}
                    onPress={() => void restore()}
                  >
                    <Text style={s.buttonText}>Réessayer</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : session ? (
            <View style={s.card}>
              <Text style={s.eyebrow}>
                {session.role === "coach"
                  ? "ESPACE COACH"
                  : "ESPACE UTILISATEUR"}
              </Text>
              <Text style={s.title}>Vous êtes connecté.</Text>
              <Text style={s.text}>
                Votre connexion est établie. Le parcours de suivi sera
                disponible ici prochainement.
              </Text>
              {session.role === "coach" && (
                <View>
                  <Text style={s.label}>Mon code coach</Text>
                  {session.coachCode ? <>
                    <Text selectable style={s.title}>{session.coachCode}</Text>
                    <Pressable accessibilityRole="button" onPress={async () => {
                      try {
                        const copied = await Clipboard.setStringAsync(session.coachCode!);
                        setCopyStatus(copied ? "Code copié." : "Copie impossible. Sélectionnez le code pour le copier.");
                      } catch { setCopyStatus("Copie impossible. Sélectionnez le code pour le copier."); }
                    }}><Text style={s.link}>Copier mon code</Text></Pressable>
                    <Text style={s.text}>Transmettez ce code à votre utilisateur pour son inscription.</Text>
                    {!!copyStatus && <Text accessibilityLiveRegion="polite" style={s.text}>{copyStatus}</Text>}
                  </> : <Text style={s.text}>Déconnectez-vous puis reconnectez-vous pour obtenir votre code.</Text>}
                </View>
              )}
              {error && (
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={[s.button, busy && s.disabled]}
                onPress={() => void signOut()}
              >
                <Text style={s.buttonText}>
                  {busy ? "Déconnexion…" : "Se déconnecter"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.tabs} accessibilityRole="tablist">
                {(["connexion", "inscription"] as const).map((tab) => {
                  const selected = (tab === "inscription") === registering;
                  return <Pressable key={tab} accessibilityRole="tab"
                    accessibilityState={{ selected, disabled: busy || registrationBusy }}
                    disabled={busy || registrationBusy}
                    onPress={() => changeTab(tab)}
                    style={[s.tab, selected && s.tabSelected]}>
                    <Text style={[s.tabText, selected && s.tabTextSelected]}>
                      {tab === "connexion" ? "Connexion" : "Inscription"}
                    </Text>
                  </Pressable>;
                })}
              </View>
              <Text style={s.text}>
                {registering ? "Créez votre compte pour rejoindre votre espace." : "Connectez-vous pour retrouver votre espace personnel."}
              </Text>
              {registering ? <RegistrationForm onBusyChange={setRegistrationBusy} onRegistered={(registeredEmail) => {
                setEmail(registeredEmail);
                setPassword("");
                setRegistered(true);
                router.setParams({ auth: "connexion" });
              }} /> : <View style={s.card}>
                {registered && !error && !validation && (
                  <Text accessibilityRole="alert" style={s.text}>Compte enregistré. Connectez-vous avec vos identifiants.</Text>
                )}
                <Text style={s.label}>Adresse e-mail</Text>
                <TextInput
                  accessibilityLabel="Adresse e-mail"
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!busy}
                  placeholder="vous@exemple.fr"
                  placeholderTextColor="#74887f"
                />
                <Text style={s.label}>Mot de passe</Text>
                <TextInput
                  accessibilityLabel="Mot de passe"
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!visible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  editable={!busy}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisible(!visible)}
                >
                  <Text style={s.link}>
                    {visible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"}
                  </Text>
                </Pressable>
                {(validation || error) && (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    style={s.error}
                  >
                    {validation || error}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  style={[s.button, busy && s.disabled]}
                  onPress={submit}
                >
                  <Text style={s.buttonText}>
                    {busy ? "Connexion…" : "Se connecter"}
                  </Text>
                </Pressable>
              </View>}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
