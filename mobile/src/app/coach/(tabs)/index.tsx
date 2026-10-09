import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { attentionLevel, clientsOverview, coachActionLabel, coachAlerts, sortForCoach, type ClientOverview } from "../../../coaching/api";
import { formatWeight } from "../../../measurements/presentation";
import { Button, Screen } from "../../../plans/ui";
import { ChevronRight } from "../../../ui/icons";
import { styles as s } from "../../../ui/styles";
import { colors } from "../../../ui/theme";

const SECTIONS = [
  { level: 2 as const, title: "À surveiller", hint: "Un écart ou des données manquantes : à regarder en premier." },
  { level: 1 as const, title: "En attente", hint: "Pas encore de plan ou de première pesée." },
  { level: 0 as const, title: "À jour", hint: "Poids et alimentation dans les objectifs." },
];

function UserCard({ client }: { client: ClientOverview }) {
  const poids = client.suiviPoids;
  const alerts = coachAlerts(client);
  const level = attentionLevel(client);
  const action = alerts[0]?.action;
  const accent = level === 2 ? colors.warning : level === 1 ? colors.muted : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Consulter le suivi de ${client.email}. ${alerts.length ? alerts.map((a) => a.raison).join(". ") : "Tout est dans les objectifs"}${action ? `. Action proposée : ${coachActionLabel[action]}` : ""}`}
      onPress={() => router.push({ pathname: "/coach/[userId]", params: { userId: client.id } })}
      style={({ pressed }) => [
        s.card,
        { padding: 16, gap: 10, borderLeftWidth: 4, borderLeftColor: accent },
        pressed && { backgroundColor: colors.mintSoft },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.brand, fontSize: 17, fontWeight: "800" }}>{client.email.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={s.label}>{client.email}</Text>
          <Text style={s.historyMeta}>
            {poids?.derniereMesure
              ? `${formatWeight(poids.derniereMesure.poidsKg)} · objectif ${formatWeight(poids.plan.poidsCible)}`
              : poids
                ? `Objectif ${formatWeight(poids.plan.poidsCible)}`
                : client.tailleCm ? `${client.tailleCm} cm` : "Profil incomplet"}
          </Text>
        </View>
        <ChevronRight color={colors.brand} />
      </View>
      {alerts.length > 0 ? (
        <View style={{ gap: 4 }}>
          {alerts.map((alert) => (
            <Text key={alert.raison} style={{ color: level === 2 ? colors.warning : colors.ink, fontSize: 14, fontWeight: "600" }}>
              • {alert.raison}
            </Text>
          ))}
          {action && (
            <Text style={[s.pillText, { marginTop: 2 }]}>→ {coachActionLabel[action]}</Text>
          )}
        </View>
      ) : (
        <Text style={[s.historyMeta, { color: colors.brand, fontWeight: "600" }]}>✓ Dans les clous et dans le budget</Text>
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

  const counts = SECTIONS.map((section) => clients.filter((client) => attentionLevel(client) === section.level).length);

  return (
    <Screen
      inTabs
      eyebrow="ESPACE COACH"
      title="Mes utilisateurs"
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
        <>
        <View style={[s.card, { flexDirection: "row", paddingVertical: 14 }]} accessible accessibilityLabel={SECTIONS.map((section, i) => `${counts[i]} ${section.title.toLowerCase()}`).join(", ")}>
          {SECTIONS.map((section, i) => (
            <View key={section.level} style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: section.level === 2 && counts[i] ? colors.warning : colors.ink }}>{counts[i]}</Text>
              <Text style={s.historyMeta}>{section.title}</Text>
            </View>
          ))}
        </View>
        {SECTIONS.map((section) => {
          const rows = clients.filter((client) => attentionLevel(client) === section.level);
          if (rows.length === 0) return null;
          return (
            <View key={section.level} style={{ gap: 10 }}>
              <View style={{ gap: 2, marginTop: section.level === 2 ? 0 : 6 }}>
                <Text accessibilityRole="header" style={[s.metricLabel, { color: section.level === 2 ? colors.warning : colors.muted }]}>
                  {section.title} · {rows.length}
                </Text>
                <Text style={s.historyMeta}>{section.hint}</Text>
              </View>
              {rows.map((client) => <UserCard key={client.id} client={client} />)}
            </View>
          );
        })}
        </>
      )}
    </Screen>
  );
}
