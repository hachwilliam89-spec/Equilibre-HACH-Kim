import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { Client, clients } from "../../plans/api";
import { Button, Screen } from "../../plans/ui";
import { styles as s } from "../../ui/styles";
export default function MyUsers() {
  const [users, setUsers] = useState<Client[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void clients().then((data) => { if (active) setUsers(data); }).catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  return <Screen><Text style={s.title}>Mes utilisateurs</Text>
    {loading ? <ActivityIndicator /> : error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : users.length === 0 ? <Text style={s.text}>Aucun utilisateur rattaché. Transmettez votre code coach pour permettre leur inscription.</Text> : users.map((user) => <Pressable key={user.id} accessibilityRole="button" style={s.card} onPress={() => router.push({ pathname: "/coach/[userId]", params: { userId: user.id } })}><Text style={s.label}>{user.email}</Text><Text style={s.link}>Consulter le plan →</Text></Pressable>)}
    <Button title="Actualiser" disabled={loading} onPress={() => { setLoading(true); setError(""); setReload((v) => v + 1); }} />
    <Button title="Mon compte et mon code coach" onPress={() => router.replace("/")} />
  </Screen>;
}
