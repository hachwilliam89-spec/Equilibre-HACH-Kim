import { View } from "react-native";
import { Field } from "../plans/ui";

/** Prénom et nom côte à côte. */
export function IdentityFields({ prenom, nom, onPrenom, onNom, disabled = false }: {
  prenom: string;
  nom: string;
  onPrenom: (value: string) => void;
  onNom: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Field label="Prénom" value={prenom} onChange={onPrenom} disabled={disabled} />
      </View>
      <View style={{ flex: 1 }}>
        <Field label="Nom" value={nom} onChange={onNom} disabled={disabled} />
      </View>
    </View>
  );
}
