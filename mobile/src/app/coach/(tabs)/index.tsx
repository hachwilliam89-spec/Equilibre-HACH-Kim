import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { attentionLevel, clientsOverview, coachActionLabel, coachAlerts, sortForCoach, type ClientOverview } from "../../../coaching/api";
import { displayName, initials, lastActivityLabel, matchesSearch } from "../../../identity/identity";
import { formatWeight } from "../../../measurements/presentation";
import { Button, Screen } from "../../../plans/ui";
import { ChevronRight } from "../../../ui/icons";
import { SearchField } from "../../../ui/SearchField";
import { styles as s } from "../../../ui/styles";
import { colors } from "../../../ui/theme";

const SECTIONS = [
  { level: 2 as const, title: "À surveiller" },
  { level: 1 as const, title: "En attente" },
  { level: 0 as const, title: "Sans alerte" },
];
type AttentionFilter = (typeof SECTIONS)[number]["level"] | null;

function UserCard({ client }: { client: ClientOverview }) {
  const poids = client.suiviPoids;
  const alerts = coachAlerts(client);
  const level = attentionLevel(client);
  const priorityAlert = alerts[0];
  const action = priorityAlert?.action;
  const accent = level === 2 ? colors.warning : level === 1 ? colors.muted : colors.brand;
  const name = displayName(client);
  const activity = poids ? lastActivityLabel(client.derniereActivite) : null;
  const inactive = !!activity && !activity.startsWith("Actif");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Consulter le suivi de ${name}. ${activity ? `${activity}. ` : ""}${alerts.length ? alerts.map((a) => a.raison).join(". ") : "Aucun écart récent signalé"}${action ? `. Action proposée : ${coachActionLabel[action]}` : ""}`}
      onPress={() => router.push({ pathname: "/coach/[userId]", params: { userId: client.id } })}
      style={({ pressed }) => [
        s.card,
        { padding: 16, gap: 10, borderLeftWidth: 4, borderLeftColor: accent },
        pressed && { backgroundColor: colors.mintSoft },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.brand, fontSize: 15, fontWeight: "800" }}>{initials(client)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={s.label}>{name}</Text>
          <Text style={s.historyMeta}>
            {poids?.derniereMesure
              ? `${formatWeight(poids.derniereMesure.poidsKg)} · objectif ${formatWeight(poids.plan.poidsCible)}`
              : poids
                ? `Objectif ${formatWeight(poids.plan.poidsCible)}`
                : client.tailleCm ? `${client.tailleCm} cm` : "Profil incomplet"}
          </Text>
          {activity && (
            <Text style={[s.historyMeta, { color: inactive ? colors.warning : colors.muted, fontWeight: inactive ? "600" : "400" }]}>
              {activity}
            </Text>
          )}
        </View>
        <ChevronRight color={colors.brand} />
      </View>
      {priorityAlert ? (
        <View style={{ gap: 4 }}>
          <Text numberOfLines={2} style={{ color: level === 2 ? colors.warning : colors.ink, fontSize: 14, fontWeight: "600" }}>
            {priorityAlert.raison}{alerts.length > 1 ? ` · +${alerts.length - 1} autre${alerts.length > 2 ? "s" : ""}` : ""}
          </Text>
          {action && (
            <Text style={[s.pillText, { marginTop: 2 }]}>{coachActionLabel[action]} →</Text>
          )}
        </View>
      ) : (
        <Text style={[s.historyMeta, { color: colors.brand, fontWeight: "600" }]}>Aucun écart récent signalé</Text>
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttentionFilter>(null);

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

  const searched = clients.filter((client) => matchesSearch(client, query));
  const counts = SECTIONS.map((section) => searched.filter((client) => attentionLevel(client) === section.level).length);
  const visible = filter === null ? searched : searched.filter((client) => attentionLevel(client) === filter);

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
        <View style={[s.card, { flexDirection: "row", padding: 6, gap: 4 }]}>
          {SECTIONS.map((section, i) => (
            <Pressable
              key={section.level}
              accessibilityRole="button"
              accessibilityLabel={`${section.title}, ${counts[i]} utilisateur${counts[i] > 1 ? "s" : ""}`}
              accessibilityHint={filter === section.level ? "Afficher tous les utilisateurs" : `Afficher les utilisateurs ${section.title.toLowerCase()}`}
              accessibilityState={{ selected: filter === section.level }}
              onPress={() => setFilter((current) => current === section.level ? null : section.level)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 68,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                borderRadius: 14,
                backgroundColor: filter === section.level ? (section.level === 2 ? "#fff0db" : colors.mint) : pressed ? colors.mintSoft : colors.card,
              })}
            >
              <Text style={{ fontSize: 25, fontWeight: "800", color: section.level === 2 && counts[i] ? colors.warning : colors.ink }}>{counts[i]}</Text>
              <Text style={[s.historyMeta, { fontWeight: filter === section.level ? "700" : "500", color: filter === section.level ? colors.ink : colors.muted }]}>{section.title}</Text>
            </Pressable>
          ))}
        </View>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Rechercher par nom ou e-mail"
          accessibilityLabel="Rechercher un utilisateur par nom ou e-mail"
        />
        {filter !== null && (
          <Pressable accessibilityRole="button" onPress={() => setFilter(null)} style={{ alignSelf: "flex-start" }}>
            <Text style={s.link}>Afficher toutes les priorités</Text>
          </Pressable>
        )}
        {visible.length === 0 && (
          <View style={s.card}>
            <Text style={s.text}>{query.trim()
              ? `Aucun utilisateur ne correspond à « ${query.trim()} »${filter === null ? "." : " dans cette priorité."}`
              : "Aucun utilisateur dans cette priorité."}</Text>
          </View>
        )}
        {SECTIONS.map((section) => {
          const rows = visible.filter((client) => attentionLevel(client) === section.level);
          if (rows.length === 0) return null;
          return (
            <View key={section.level} style={{ gap: 10 }}>
              {filter === null && <Text accessibilityRole="header" style={[s.metricLabel, { marginTop: section.level === 2 ? 0 : 6, color: section.level === 2 ? colors.warning : colors.muted }]}>
                {section.title} · {rows.length}
              </Text>}
              {rows.map((client) => <UserCard key={client.id} client={client} />)}
            </View>
          );
        })}
        </>
      )}
    </Screen>
  );
}
