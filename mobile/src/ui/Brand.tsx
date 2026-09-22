import { Image, View } from "react-native";

export function Brand() {
  return (
    <View style={{ width: "100%", aspectRatio: 690 / 280, overflow: "hidden" }}>
      <Image
        source={require("../../assets/equilibre-logo.png")}
        accessibilityLabel="Equilibre — Trouvez le vôtre"
        accessible
        resizeMode="contain"
        // Le fichier original contient une marge vide à droite.
        style={{ width: `${(1160 / 690) * 100}%`, height: "100%" }}
      />
    </View>
  );
}
