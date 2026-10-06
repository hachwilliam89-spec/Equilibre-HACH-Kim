import { Pressable, Text, View } from "react-native";
import { styles as s } from "../ui/styles";
import { etatSynchro, messageRejet } from "./presentation";
import { useSync } from "./useSync";

const couleurs = {
  neutre: { fond: "#edf4f0", texte: "#536861" },
  attente: { fond: "#eaf0ff", texte: "#315da8" },
  alerte: { fond: "#fff0dc", texte: "#9a4d00" },
};

/** État de la synchronisation + modifications refusées par le serveur. */
export function SyncStatus() {
  const { enCours, horsLigne, erreur, rejets, vue, synchroniser, effacerRejets } = useSync();
  const etat = etatSynchro({
    enCours,
    horsLigne,
    synchroniseLe: vue.synchroniseLe,
    operationsEnAttente: vue.operationsEnAttente,
  });
  const couleur = couleurs[etat.ton];
  return (
    <View style={{ gap: 8 }}>
      <View
        accessible
        accessibilityLabel={etat.texte}
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: couleur.fond,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
      >
        <Text style={{ flex: 1, color: couleur.texte, fontSize: 14, fontWeight: "600" }}>
          {etat.texte}
        </Text>
        {!enCours && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Synchroniser maintenant"
            onPress={() => void synchroniser()}
            hitSlop={8}
          >
            <Text style={[s.link, { paddingVertical: 0 }]}>Synchroniser</Text>
          </Pressable>
        )}
      </View>
      {!!erreur && (
        <Text accessibilityRole="alert" style={s.error}>
          {erreur}
        </Text>
      )}
      {rejets.length > 0 && (
        <View
          accessibilityRole="alert"
          style={{ backgroundColor: "#fff0dc", borderRadius: 12, padding: 12, gap: 6 }}
        >
          {rejets.map((rejet) => (
            <Text key={rejet.operation.id} style={{ color: "#9a4d00", fontSize: 14, lineHeight: 20 }}>
              {messageRejet(rejet)}
            </Text>
          ))}
          <Pressable accessibilityRole="button" onPress={effacerRejets} style={{ alignSelf: "flex-start" }}>
            <Text style={s.link}>J’ai compris</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
