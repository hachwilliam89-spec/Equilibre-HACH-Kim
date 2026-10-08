import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { attentionLevel, clientsOverview, sortForCoach, type ClientOverview } from "../../../coaching/api";
import { formatSignedWeight, formatUtcDay, formatWeight, trackingPresentation } from "../../../measurements/presentation";
import { foodStatusPresentation } from "../../../nutrition/presentation";
import { Button, Screen } from "../../../plans/ui";
import { BowlIcon, ChevronRight, ScaleIcon } from "../../../ui/icons";
import { styles as s } from "../../../ui/styles";
import { colors } from "../../../ui/theme";

function StatusPill({ icon, label, symbol, color, background }: { icon: React.ReactNode; label: string; symbol?: string; color: string; background: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: background }}>
      {icon}
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{symbol ? `${symbol} ` : ""}{label}</Text>
    </View>
  );
}

function UserCard({ client }: { client: ClientOverview }) {
  const poids = client.suiviPoids;
  const alimentation = client.alimentation;
  const level = attentionLevel(client);
  const weight = poids ? trackingPresentation[poids.statut] : null;
  const food = alimentation ? foodStatusPresentation[alimentation.statut] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Consulter le suivi de ${client.email}${weight ? `, poids : ${weight.label}` : ", aucun plan actif"}${food ? `, alimentation : ${food.label}` : ""}`}
      onPress={() => router.push({ pathname: "/coach/[userId]", params: { userId: client.id } })}
      style={({ pressed }) => [
        s.card,
        { padding: 16, gap: 12 },
        level === 2 && { borderColor: "#f1c58e", borderLeftWidth: 4 },
        pressed && { backgroundColor: colors.mintSoft },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.brand, fontSize: 18, fontWeight: "800" }}>{client.email.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={s.label}>{client.email}</Text>
          <Text style={s.historyMeta}>
            {poids?.derniereMesure
              ? `${formatWeight(poids.derniereMesure.poidsKg)} le ${formatUtcDay(poids.derniereMesure.jourUtc)}${poids.ecartKg !== null ? ` · écart ${formatSignedWeight(poids.ecartKg)}` : ""}`
              : poids
                ? `Objectif ${formatWeight(poids.plan.poidsCible)} · aucune pesée`
                : "Aucun plan actif"}
          </Text>
        </View>
        <ChevronRight color={colors.brand} />
      </View>
      {(weight || food) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {weight && (
            <StatusPill icon={<ScaleIcon size={14} color={weight.color} />} label={weight.label} color={weight.color} background={weight.background} />
          )}
          {food && (
            <StatusPill icon={<BowlIcon size={14} color={food.color} />} label={food.label} color={food.color} background={food.background} />
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function MyUsers() {
  const [clients, setClients] = useState<ClientOverview[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void clientsOverview()
      .then((data) => { if (active) { setClients(sortForCoach(data)); setError(""); } })
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

  const aSurveiller = clients.filter((client) => attentionLevel(client) === 2).length;

  return (
    <Screen
      inTabs
      eyebrow="ESPACE COACH"
      title="Mes utilisateurs"
      subtitle={
        loading || error
          ? undefined
          : `${clients.length} suivi${clients.length > 1 ? "s" : ""}${aSurveiller ? ` · ${aSurveiller} à surveiller` : " · tout est à jour"}`
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
      ) : clients.length === 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Aucun utilisateur rattaché</Text>
          <Text style={s.text}>
            Transmettez votre code coach (onglet « Mon compte ») pour permettre leur inscription.
          </Text>
        </View>
      ) : (
        clients.map((client) => <UserCard key={client.id} client={client} />)
      )}
    </Screen>
  );
}
