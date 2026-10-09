import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MeasurementField } from "../../../ui/MeasurementField";
import {
  getProfile,
  profileUpdateSchema,
  updateProfile,
  type Profile,
} from "../../../profile/api";
import { LogoutButton } from "../../../auth/LogoutButton";
import { Button, Field, InfoRow, Screen } from "../../../plans/ui";
import { colors } from "../../../ui/theme";
import { styles as s } from "../../../ui/styles";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taille, setTaille] = useState("");
  const [age, setAge] = useState("");
  const [sexe, setSexe] = useState<"homme" | "femme" | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  const applyProfile = (next: Profile) => {
    setProfile(next);
    setTaille(next.tailleCm?.toString() ?? "");
    setAge(next.age?.toString() ?? "");
    setSexe(next.sexe);
  };

  const load = () => {
    setLoading(true);
    setError("");
    void getProfile()
      .then(applyProfile)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible de charger votre profil.",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    void getProfile()
      .then((next) => {
        if (active) applyProfile(next);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible de charger votre profil.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    if (pending.current) return;
    const parsed = profileUpdateSchema.safeParse({
      tailleCm: Number(taille.trim().replace(",", ".")),
      age: age.trim() ? Number(age.trim()) : undefined,
      sexe,
    });
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
      applyProfile(await updateProfile(parsed.data));
      setNotice("Profil enregistré.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d’enregistrer votre profil.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen inTabs eyebrow="ESPACE UTILISATEUR" title="Mon profil" heroAction={<LogoutButton />}>
      {loading ? (
        <View style={s.card}>
          <ActivityIndicator
            color={colors.brand}
            accessibilityLabel="Chargement du profil"
          />
          <Text style={s.text}>Chargement de votre profil…</Text>
        </View>
      ) : error && !profile ? (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>{error}</Text>
          <Button title="Réessayer" onPress={load} />
        </View>
      ) : profile ? (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>Mon compte</Text>
            <InfoRow label="E-mail" value={profile.email} />
            <InfoRow label="Coach" value={profile.coach.email} />
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>Mes informations</Text>
            <Text style={s.historyMeta}>
              La taille permet à votre coach de créer votre plan. L’âge et le sexe servent au calcul du budget calorique.
            </Text>
            <MeasurementField
              label="Taille (cm) · obligatoire"
              unit="cm"
              value={taille}
              onChange={setTaille}
              disabled={saving}
            />
            <Field
              label="Âge · facultatif"
              value={age}
              onChange={setAge}
              numeric
              disabled={saving}
            />
            <Text style={s.label}>Sexe biologique · facultatif</Text>
            <View style={s.choiceRow}>
              {([undefined, "femme", "homme"] as const).map((choice) => (
                <Pressable
                  key={choice ?? "non-renseigne"}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sexe === choice, disabled: saving }}
                  disabled={saving}
                  onPress={() => setSexe(choice)}
                  style={[s.choice, sexe === choice && s.choiceSelected]}
                >
                  <Text style={s.label}>
                    {choice === undefined
                      ? "Non renseigné"
                      : choice === "femme"
                        ? "Femme"
                        : "Homme"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            {!!notice && <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
            <Button
              title={saving ? "Enregistrement…" : "Enregistrer mon profil"}
              disabled={saving}
              onPress={() => void submit()}
            />
          </View>
        </>
      ) : null}

    </Screen>
  );
}
