import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "../plans/ui";
import { formatUtcDay } from "../measurements/presentation";
import { styles as s } from "../ui/styles";
import { colors } from "../ui/theme";
import { getActivity, type Activite } from "./api";
import { formatPas, lignesActivite, moyenneSummary } from "./presentation";

type Resultat =
  | { etat: "ok"; activite: Activite }
  | { etat: "erreur"; message: string };

/**
 * Activité transmise par la montre (US4), à titre informatif : aucun statut
 * ni alerte. Chargée en ligne ; hors ligne, un message remplace la carte.
 */
export function ActivityCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [essai, setEssai] = useState(0);
  const cle = `${refreshKey}-${essai}`;
  // Résultat associé à la demande qui l'a produit : une nouvelle clé
  // affiche le chargement sans remise à zéro synchrone dans l'effet.
  const [resultat, setResultat] = useState<{ cle: string } & Resultat>();

  useEffect(() => {
    let actif = true;
    getActivity()
      .then((activite) => {
        if (actif) setResultat({ cle, etat: "ok", activite });
      })
      .catch((cause: unknown) => {
        if (actif) {
          setResultat({
            cle,
            etat: "erreur",
            message: cause instanceof Error ? cause.message : "Activité indisponible.",
          });
        }
      });
    return () => {
      actif = false;
    };
  }, [cle]);

  const state = resultat && resultat.cle === cle ? resultat : { etat: "chargement" as const };

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Activité · 7 derniers jours</Text>
      {state.etat === "chargement" && (
        <ActivityIndicator color={colors.brand} accessibilityLabel="Chargement de l’activité" />
      )}
      {state.etat === "erreur" && (
        <>
          <Text style={s.text}>Activité indisponible : elle se consulte en ligne.</Text>
          <Text style={s.historyMeta}>{state.message}</Text>
          <Button title="Réessayer" variant="secondary" onPress={() => setEssai((n) => n + 1)} />
        </>
      )}
      {state.etat === "ok" && (
        <>
          <Text style={s.label}>{moyenneSummary(state.activite.moyenne7Jours)}</Text>
          {state.activite.historique.length === 0 ? (
            <Text style={s.text}>Aucun pas transmis par la montre pour le moment.</Text>
          ) : (
            lignesActivite(state.activite, new Date().toISOString().slice(0, 10)).map((jour) => (
              <View key={jour.jourUtc} style={s.summaryRow} accessible>
                <Text style={s.text}>
                  {jour.enCours ? "Aujourd’hui · en cours" : formatUtcDay(jour.jourUtc)}
                </Text>
                <Text style={[s.text, { fontWeight: "700", color: jour.enCours ? colors.muted : colors.ink }]}>
                  {formatPas(jour.nombrePas)}
                </Text>
              </View>
            ))
          )}
          <Text style={s.historyMeta}>Moyenne calculée sur les 7 jours précédant aujourd’hui. À titre indicatif : le niveau sert au coach pour calculer le budget d’un nouveau plan.</Text>
        </>
      )}
    </View>
  );
}
