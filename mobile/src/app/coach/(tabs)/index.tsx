import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Client, clients } from "../../../plans/api";
import { Button, Screen } from "../../../plans/ui";
import { ChevronRight } from "../../../ui/icons";
import { styles as s } from "../../../ui/styles";
import { colors } from "../../../ui/theme";

function UserCard({ user }: { user: Client }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Consulter le plan de ${user.email}`}
      onPress={() => router.push({ pathname: "/coach/[userId]", params: { userId: user.id } })}
      style={({ pressed }) => [s.card, { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }, pressed && { backgroundColor: colors.mintSoft }]}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.brand, fontSize: 18, fontWeight: "800" }}>
          {user.email.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={s.label}>{user.email}</Text>
        <Text style={s.historyMeta}>
          {user.tailleCm ? `${user.tailleCm} cm` : "Taille non renseignée"}
          {user.age ? ` · ${user.age} ans` : ""}
        </Text>
      </View>
      <ChevronRight color={colors.brand} />
    </Pressable>
  );
}

export default function MyUsers() {
  const [users, setUsers] = useState<Client[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void clients()
      .then((data) => { if (active) { setUsers(data); setError(""); } })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Impossible de charger vos utilisateurs.");
      })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [reload]);

  const refresh = () => {
    setRefreshing(true);
    setReload((value) => value + 1);
  };

  return (
    <Screen
      inTabs
      eyebrow="ESPACE COACH"
      title="Mes utilisateurs"
      subtitle={
        loading || error
          ? undefined
          : `${users.length} utilisateur${users.length > 1 ? "s" : ""} suivi${users.length > 1 ? "s" : ""}`
      }
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {loading ? (
        <View style={s.card}>
          <ActivityIndicator color={colors.brand} accessibilityLabel="Chargement des utilisateurs" />
        </View>
      ) : error ? (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>{error}</Text>
          <Button title="Réessayer" onPress={refresh} />
        </View>
      ) : users.length === 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Aucun utilisateur rattaché</Text>
          <Text style={s.text}>
            Transmettez votre code coach (onglet « Mon compte ») pour permettre leur inscription.
          </Text>
        </View>
      ) : (
        users.map((user) => <UserCard key={user.id} user={user} />)
      )}
    </Screen>
  );
}
